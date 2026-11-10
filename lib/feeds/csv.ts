import { parse } from "csv-parse";
import { gunzipSync } from "node:zlib";
import type { FeedRow } from "../ingest";
import { toPence } from "../normalise";

/**
 * Column mapping from a network's CSV header to FeedRow fields.
 * Each entry lists candidate column names, first match wins.
 */
export type ColumnMap = Record<keyof FeedRow, string[]>;

/** Passo's own neutral CSV format, used for manual feeds and tests. */
export const passoColumns: ColumnMap = {
  merchantName: ["merchant_name"],
  merchantDomain: ["merchant_domain"],
  networkMerchantId: ["merchant_id"],
  sku: ["sku"],
  gtin: ["gtin"],
  brand: ["brand"],
  mpn: ["mpn"],
  title: ["title"],
  category: ["category"],
  imageUrl: ["image_url"],
  pricePence: ["price"],
  deliveryPence: ["delivery_cost"],
  inStock: ["in_stock"],
  url: ["url"],
  clickUrl: ["click_url"],
};

export function decode(buf: Buffer): string {
  const isGzip = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b;
  return (isGzip ? gunzipSync(buf) : buf).toString("utf8");
}

export async function* parseCsv(text: string, columns: ColumnMap, delimiter = ","): AsyncGenerator<FeedRow> {
  const parser = parse(text, { columns: true, delimiter, skip_empty_lines: true, relax_column_count: true, bom: true });
  for await (const rec of parser as AsyncIterable<Record<string, string>>) {
    yield mapRecord(rec, columns);
  }
}

function pick(rec: Record<string, string>, names: string[]): string | null {
  for (const n of names) {
    const v = rec[n];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function truthy(v: string | null): boolean {
  if (v === null) return true; // feeds that omit stock usually list in-stock items only
  return ["1", "true", "yes", "y", "in stock", "in_stock", "instock"].includes(v.toLowerCase());
}

export function mapRecord(rec: Record<string, string>, c: ColumnMap): FeedRow {
  const delivery = pick(rec, c.deliveryPence);
  return {
    merchantName: pick(rec, c.merchantName) ?? "",
    merchantDomain: pick(rec, c.merchantDomain),
    networkMerchantId: pick(rec, c.networkMerchantId),
    sku: pick(rec, c.sku) ?? "",
    gtin: pick(rec, c.gtin),
    brand: pick(rec, c.brand),
    mpn: pick(rec, c.mpn),
    title: pick(rec, c.title) ?? "",
    category: pick(rec, c.category),
    imageUrl: pick(rec, c.imageUrl),
    pricePence: toPence(pick(rec, c.pricePence)),
    deliveryPence: delivery === null ? null : toPence(delivery),
    inStock: truthy(pick(rec, c.inStock)),
    url: pick(rec, c.url) ?? "",
    clickUrl: pick(rec, c.clickUrl),
  };
}
