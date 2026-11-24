import { decode, mapRecord, parseCsv, type ColumnMap } from "./csv";
import { delimiterOf, googleColumns, parseGoogleXml, withMerchant, type MerchantInfo } from "./google";
import { ingestRows, type FeedRow, type IngestResult } from "../ingest";
import { domainFromUrl } from "../normalise";

/**
 * Webgains product feed adapter.
 *
 * Webgains exports a feed per joined programme from the publisher dashboard
 * (Programs > Product feeds). Its classic column set is below; newer feeds
 * follow Google's names, so both are read and the header decides. Webgains'
 * `deeplink` is the tracked link, so the merchant's own page comes from
 * `product_url`/`link` when present and the shop's domain comes from config.
 *
 * Configured in WEBGAINS_FEEDS as JSON: [{"name":"Shop","domain":"shop.co.uk","url":"https://..."}].
 * The URLs carry the publisher key, so they are secret and never logged.
 *
 * The classic column names follow Webgains' published spec; check them
 * against the first real export and adjust the candidates if needed.
 */
export const webgainsColumns: ColumnMap = {
  merchantName: ["program_name", "merchant_name"],
  merchantDomain: [],
  networkMerchantId: ["program_id", "merchant_id"],
  sku: ["product_id", "merchant_product_id", "sku", "id"],
  gtin: ["ean", "gtin", "upc", "barcode"],
  brand: ["brand", "brand_name", "manufacturer"],
  mpn: ["mpn", "manufacturers_product_number", "model_number"],
  title: ["product_name", "name", "title"],
  category: ["category_name", "merchant_category", "category", "product_type"],
  imageUrl: ["image_url", "large_image", "image_link"],
  pricePence: ["price", "sale_price", "search_price"],
  deliveryPence: ["delivery_cost", "shipping_price", "shipping"],
  inStock: ["in_stock", "stock", "availability"],
  url: ["product_url", "merchant_deep_link", "link"],
  clickUrl: ["deeplink", "deep_link", "tracking_link"],
};

const googleWithTracking: ColumnMap = { ...googleColumns, clickUrl: ["deeplink", "deep_link", "tracking_link"] };

export interface WebgainsFeed extends MerchantInfo {
  url: string;
}

/** Webgains entries need a domain: the feed's links point at Webgains, not the shop. */
export function webgainsFeeds(raw = process.env.WEBGAINS_FEEDS): WebgainsFeed[] {
  return parseFeedConfig(raw).filter((f) => !!f.domain);
}

/** Reads a JSON list of {name, domain, url}; bad entries are skipped. Shared with direct feeds. */
export function parseFeedConfig(raw: string | undefined): WebgainsFeed[] {
  if (!raw || !raw.trim()) return [];
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    throw new Error("Feed config is not valid JSON");
  }
  if (!Array.isArray(list)) return [];
  return list
    .filter((f): f is WebgainsFeed => !!f && typeof f.name === "string" && typeof f.url === "string" && /^https:\/\//.test(f.url))
    .map((f) => ({ name: f.name.trim(), domain: f.domain ? String(f.domain).trim().toLowerCase() : null, url: f.url.trim() }));
}

/**
 * When the row only has the tracked link, the shop's page is unknown: use the
 * tracked link for both and let the configured domain identify the merchant.
 */
function fixUrls(row: FeedRow, m: MerchantInfo): FeedRow {
  const url = row.url || row.clickUrl || "";
  const own = domainFromUrl(url);
  return { ...row, url, merchantDomain: m.domain ?? (own && !own.includes("webgains") ? own : null) };
}

export async function* parseWebgainsFeed(buf: Buffer, m: MerchantInfo): AsyncGenerator<FeedRow> {
  const text = decode(buf);
  if (text.trimStart().startsWith("<")) {
    for (const rec of parseGoogleXml(text)) yield fixUrls(withMerchant(mapRecord(rec, googleWithTracking), m), m);
    return;
  }
  const header = text.slice(0, 2000).split(/\r?\n/)[0] ?? "";
  const cols = header.split(delimiterOf(header)).map((c) => c.replace(/^"|"$/g, "").trim());
  const classic = cols.includes("product_name") || cols.includes("program_name");
  for await (const row of parseCsv(text, classic ? webgainsColumns : googleWithTracking, delimiterOf(header))) {
    yield fixUrls(withMerchant(row, m), m);
  }
}

export async function ingestWebgainsFeed(feed: WebgainsFeed, source: string, deadline?: number): Promise<IngestResult> {
  const res = await fetch(feed.url, { headers: { "accept-encoding": "gzip" } });
  if (!res.ok) throw new Error(`Webgains feed download failed: HTTP ${res.status}`);
  return ingestRows("webgains", source, parseWebgainsFeed(Buffer.from(await res.arrayBuffer()), feed), { deadline });
}
