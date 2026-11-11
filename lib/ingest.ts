import { getDb, type Db } from "./db";
import { domainFromUrl, isHttpUrl, leafCategory, matchKey, normaliseGtin, slugify } from "./normalise";

/** One offer from any feed, after the network adapter has mapped its columns. */
export interface FeedRow {
  merchantName: string;
  merchantDomain?: string | null;
  networkMerchantId?: string | null;
  sku: string;
  gtin?: string | null;
  brand?: string | null;
  mpn?: string | null;
  title: string;
  category?: string | null;
  imageUrl?: string | null;
  pricePence: number | null;
  deliveryPence?: number | null;
  inStock: boolean;
  /** The merchant's own product page. */
  url: string;
  /** Tracked link the shopper follows (affiliate deep link), or the url itself. */
  clickUrl?: string | null;
}

export interface IngestResult {
  runId: number;
  rowsIn: number;
  rowsOk: number;
  errors: number;
  errorSample: string[];
}

type IdRow = { id: number | string };

/**
 * Writes feed rows into the catalogue. Matching order for the product:
 * the offer's existing product, then GTIN, then brand plus MPN, then a new
 * single-merchant product. Title similarity never merges products.
 */
export async function ingestRows(
  network: string,
  source: string,
  rows: Iterable<FeedRow> | AsyncIterable<FeedRow>,
  opts: { country?: string; db?: Db; deadline?: number } = {},
): Promise<IngestResult> {
  const db = opts.db ?? (await getDb());
  const country = opts.country ?? "GB";
  const [run] = await db.query<IdRow>(
    "insert into feed_runs (network, source) values ($1, $2) returning id",
    [network, source],
  );
  const merchantIds = new Map<string, number>();
  let rowsIn = 0;
  let rowsOk = 0;
  const errorSample: string[] = [];

  let stoppedEarly = false;
  for await (const row of rows as AsyncIterable<FeedRow>) {
    // Finish cleanly rather than be cut off by the platform's time limit.
    if (opts.deadline && Date.now() > opts.deadline) {
      stoppedEarly = true;
      break;
    }
    rowsIn++;
    try {
      const problem = validate(row);
      if (problem) throw new Error(problem);
      const domain = (row.merchantDomain ?? domainFromUrl(row.url))!;
      let merchantId = merchantIds.get(domain);
      if (!merchantId) {
        merchantId = await upsertMerchant(db, network, domain, row);
        merchantIds.set(domain, merchantId);
      }
      const productId = await findOrCreateProduct(db, merchantId, row, country);
      await db.query(
        `insert into offers (merchant_id, product_id, merchant_sku, title, price_pence, delivery_pence,
           in_stock, url, click_url, country, last_seen)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
         on conflict (merchant_id, merchant_sku, country) do update set
           product_id = excluded.product_id, title = excluded.title, price_pence = excluded.price_pence,
           delivery_pence = excluded.delivery_pence, in_stock = excluded.in_stock, url = excluded.url,
           click_url = excluded.click_url, last_seen = now()`,
        [
          merchantId,
          productId,
          row.sku,
          row.title.trim(),
          row.pricePence,
          row.deliveryPence ?? null,
          row.inStock,
          row.url,
          row.clickUrl && isHttpUrl(row.clickUrl) ? row.clickUrl : row.url,
          country,
        ],
      );
      rowsOk++;
    } catch (err) {
      if (errorSample.length < 10) errorSample.push(`row ${rowsIn}: ${(err as Error).message}`);
    }
  }

  const errors = rowsIn - rowsOk;
  if (stoppedEarly) errorSample.unshift(`stopped after ${rowsIn} rows: time limit`);
  await db.query(
    `update feed_runs set finished_at = now(), rows_in = $2, rows_ok = $3, errors = $4, error_sample = $5
     where id = $1`,
    [run.id, rowsIn, rowsOk, errors, errorSample.join("\n") || null],
  );
  return { runId: Number(run.id), rowsIn, rowsOk, errors, errorSample };
}

function validate(row: FeedRow): string | null {
  if (!row.title?.trim()) return "missing title";
  if (!row.sku?.trim()) return "missing merchant SKU";
  if (!row.merchantName?.trim()) return "missing merchant name";
  if (!isHttpUrl(row.url)) return "product URL is not a web address";
  if (!row.pricePence || row.pricePence <= 0) return "missing or zero price";
  if (!(row.merchantDomain ?? domainFromUrl(row.url))) return "cannot work out merchant domain";
  return null;
}

async function upsertMerchant(db: Db, network: string, domain: string, row: FeedRow): Promise<number> {
  const [m] = await db.query<IdRow>(
    `insert into merchants (domain, name, network, network_merchant_id)
     values ($1, $2, $3, $4)
     on conflict (domain) do update set name = excluded.name,
       network_merchant_id = coalesce(excluded.network_merchant_id, merchants.network_merchant_id),
       updated_at = now()
     returning id`,
    [domain, row.merchantName.trim(), network, row.networkMerchantId ?? null],
  );
  return Number(m.id);
}

async function findOrCreateProduct(db: Db, merchantId: number, row: FeedRow, country: string): Promise<number> {
  // Some feeds (Awin's Google format among them) put the barcode in the MPN
  // field. A 12 to 14 digit MPN with a valid check digit is treated as a GTIN.
  const mpnDigits = row.mpn?.trim() ?? "";
  const gtin =
    normaliseGtin(row.gtin) ?? (/^\d{12,14}$/.test(mpnDigits) ? normaliseGtin(mpnDigits) : null);
  const brandKey = matchKey(row.brand);
  const mpnKey = matchKey(row.mpn);
  const category = leafCategory(row.category);

  // 1. Keep an existing offer on its product, unless it now carries a GTIN that belongs elsewhere.
  const [existing] = await db.query<{ product_id: number | string; gtin: string | null }>(
    `select o.product_id, p.gtin from offers o join products p on p.id = o.product_id
     where o.merchant_id = $1 and o.merchant_sku = $2 and o.country = $3`,
    [merchantId, row.sku, country],
  );
  if (existing && (!gtin || existing.gtin === gtin)) {
    await fillProduct(db, Number(existing.product_id), row, category, gtin);
    return Number(existing.product_id);
  }

  // 2. GTIN.
  if (gtin) {
    const [p] = await db.query<IdRow>("select id from products where gtin = $1", [gtin]);
    if (p) {
      await fillProduct(db, Number(p.id), row, category, gtin);
      return Number(p.id);
    }
  }

  // 3. Brand plus MPN, only among products without a GTIN.
  if (!gtin && brandKey && mpnKey) {
    const [p] = await db.query<IdRow>(
      "select id from products where gtin is null and brand_key = $1 and mpn_key = $2 limit 1",
      [brandKey, mpnKey],
    );
    if (p) {
      await fillProduct(db, Number(p.id), row, category, null);
      return Number(p.id);
    }
  }

  // 4. New product.
  const [p] = await db.query<IdRow>(
    `insert into products (gtin, brand, brand_key, mpn_key, title, category, category_slug, image_url)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [
      gtin,
      row.brand?.trim() || null,
      brandKey,
      mpnKey,
      row.title.trim(),
      category,
      category ? slugify(category) : null,
      row.imageUrl && isHttpUrl(row.imageUrl) ? row.imageUrl : null,
    ],
  );
  return Number(p.id);
}

/** Fills gaps on a product from a new offer without overwriting what is there. */
async function fillProduct(db: Db, id: number, row: FeedRow, category: string | null, gtin: string | null) {
  await db.query(
    `update products set
       gtin = coalesce(products.gtin, $2),
       brand = coalesce(products.brand, $3),
       brand_key = coalesce(products.brand_key, $4),
       category = coalesce(products.category, $5),
       category_slug = coalesce(products.category_slug, $6),
       image_url = coalesce(products.image_url, $7),
       updated_at = now()
     where id = $1`,
    [
      id,
      gtin,
      row.brand?.trim() || null,
      matchKey(row.brand),
      category,
      category ? slugify(category) : null,
      row.imageUrl && isHttpUrl(row.imageUrl) ? row.imageUrl : null,
    ],
  );
}
