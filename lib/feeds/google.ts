import { XMLParser } from "fast-xml-parser";
import { decode, mapRecord, parseCsv, type ColumnMap } from "./csv";
import type { FeedRow } from "../ingest";

/**
 * Google Merchant Center product feeds: the format most shops already
 * produce for Google Shopping (Shopify's Google channel, feed apps, most
 * platforms). Read as RSS/Atom XML or as CSV/TSV with Google's column names.
 * Used for direct feeds, and as a fallback when a network serves Google format.
 */
export const googleColumns: ColumnMap = {
  merchantName: [],
  merchantDomain: [],
  networkMerchantId: [],
  sku: ["id"],
  gtin: ["gtin"],
  brand: ["brand"],
  mpn: ["mpn"],
  title: ["title"],
  category: ["product_type", "google_product_category"],
  imageUrl: ["image_link"],
  pricePence: ["sale_price", "price"],
  deliveryPence: ["shipping_price", "shipping"],
  inStock: ["availability"],
  url: ["link"],
  clickUrl: [],
};

/** Merchant details a feed does not carry itself. */
export interface MerchantInfo {
  name: string;
  domain?: string | null;
}

export function withMerchant(row: FeedRow, m: MerchantInfo): FeedRow {
  return { ...row, merchantName: row.merchantName || m.name, merchantDomain: row.merchantDomain ?? m.domain ?? null };
}

/** Flattens a Google shipping value, which XML feeds nest as <g:shipping><g:price>. */
function flatten(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return flatten(value[0]);
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if ("price" in o) return flatten(o.price);
    if ("#text" in o) return flatten(o["#text"]);
    return "";
  }
  return String(value);
}

/** Parses a Google RSS 2.0 or Atom product feed into plain records keyed by Google attribute name. */
export function parseGoogleXml(xml: string): Record<string, string>[] {
  const parser = new XMLParser({
    ignoreAttributes: true,
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
  });
  const doc = parser.parse(xml) as Record<string, any>;
  const items = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? [];
  const list: Record<string, unknown>[] = Array.isArray(items) ? items : [items];
  return list.map((item) => {
    const rec: Record<string, string> = {};
    for (const [k, v] of Object.entries(item)) rec[k] = flatten(v);
    // Atom feeds put the URL in <link href>, which ignoreAttributes drops; <g:link> is preferred anyway.
    return rec;
  });
}

function delimiterOf(header: string): string {
  const counts = { "\t": header.split("\t").length, ",": header.split(",").length, "|": header.split("|").length };
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [","])[0];
}

/** Reads a Google-format feed (XML or delimited text) and tags every row with the merchant. */
export async function* parseGoogleFeed(buf: Buffer, merchant: MerchantInfo): AsyncGenerator<FeedRow> {
  const text = decode(buf);
  const start = text.trimStart().slice(0, 200);
  if (start.startsWith("<")) {
    for (const rec of parseGoogleXml(text)) yield withMerchant(mapRecord(rec, googleColumns), merchant);
    return;
  }
  const header = text.slice(0, 2000).split(/\r?\n/)[0] ?? "";
  for await (const row of parseCsv(text, googleColumns, delimiterOf(header))) yield withMerchant(row, merchant);
}

export { delimiterOf };
