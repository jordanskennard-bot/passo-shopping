import { parse } from "csv-parse/sync";
import { decode, parseCsv, type ColumnMap } from "./csv";
import { ingestRows, type IngestResult } from "../ingest";

/**
 * Awin product feed adapter.
 *
 * Two ways in, both secret because the URLs embed the publisher API key:
 *
 * - AWIN_FEED_LIST_URL (preferred): the "Feed List Download" link at the top
 *   of Toolbox > Create-a-Feed. It lists every advertiser's feed with our
 *   membership status, so each new approval is picked up with no setup.
 * - AWIN_FEED_URLS: comma separated Create-a-Feed links, for anything the
 *   list does not cover.
 *
 * Awin serves two formats. "Awin" is the classic column set; "Google" is the
 * newer Google Merchant Center style. Never log a feed URL.
 */

/** Classic Awin columns. Candidates in order, first non-empty wins. */
export const awinColumns: ColumnMap = {
  merchantName: ["merchant_name"],
  merchantDomain: [],
  networkMerchantId: ["merchant_id"],
  sku: ["merchant_product_id", "aw_product_id"],
  gtin: ["ean", "product_GTIN", "upc", "isbn"],
  brand: ["brand_name"],
  mpn: ["mpn", "model_number", "product_model"],
  title: ["product_name"],
  category: ["merchant_category", "category_name"],
  imageUrl: ["merchant_image_url", "aw_image_url", "large_image"],
  pricePence: ["search_price", "store_price"],
  deliveryPence: ["delivery_cost"],
  inStock: ["in_stock"],
  url: ["merchant_deep_link"],
  clickUrl: ["aw_deep_link"],
};

/** Awin's Google-format feed (checked against Beauti Outlet, 11 Nov 2026). */
export const awinGoogleColumns: ColumnMap = {
  merchantName: ["advertiser_name"],
  merchantDomain: [],
  networkMerchantId: ["advertiser_id"],
  sku: ["id"],
  gtin: ["gtin"],
  brand: ["brand"],
  mpn: ["mpn"],
  title: ["title"],
  category: ["product_type", "google_product_category"],
  imageUrl: ["image_link"],
  pricePence: ["sale_price", "price"],
  deliveryPence: ["shipping"],
  inStock: ["availability"],
  url: ["link"],
  clickUrl: ["aw_deep_link"],
};

/** Classic columns we ask for on top of Awin's default set. */
const EXTRA_CLASSIC_COLUMNS = ["ean", "product_GTIN", "upc", "delivery_cost", "model_number"];

export type AwinFormat = "awin" | "google";

export interface AwinFeed {
  advertiserId: string;
  advertiserName: string;
  feedId: string;
  format: AwinFormat;
  products: number;
  url: string;
}

/** Reads the feed list and keeps feeds we can use: joined, UK, in English. */
export function parseFeedList(csv: string, country = "GB"): AwinFeed[] {
  const rows = parse(csv, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true }) as Record<
    string,
    string
  >[];
  return rows
    .filter(
      (r) =>
        (r["Membership Status"] ?? "").toLowerCase() === "active" &&
        (r["Primary Region"] ?? "").toUpperCase() === country &&
        (r["Language"] ?? "English").toLowerCase().startsWith("english") &&
        (r["URL"] ?? "").startsWith("https://"),
    )
    .map((r) => ({
      advertiserId: r["Advertiser ID"],
      advertiserName: r["Advertiser Name"],
      feedId: r["Feed ID"],
      format: (r["Datafeed Format"] ?? "").toLowerCase() === "google" ? "google" : "awin",
      products: Number(r["No of products"] ?? 0) || 0,
      url: r["URL"],
    }));
}

/** Adds the barcode and delivery columns to a classic Awin download link. */
export function withExtraColumns(url: string): string {
  const marker = "/columns/";
  const at = url.indexOf(marker);
  if (at < 0) return url;
  const head = url.slice(0, at + marker.length);
  const tail = url.slice(at + marker.length);
  const slash = tail.indexOf("/");
  const segment = slash < 0 ? tail : tail.slice(0, slash);
  const rest = slash < 0 ? "" : tail.slice(slash);
  const cols = decodeURIComponent(segment).split(",").filter(Boolean);
  for (const c of EXTRA_CLASSIC_COLUMNS) if (!cols.includes(c)) cols.push(c);
  return head + encodeURIComponent(cols.join(",")) + (rest || "/");
}

export async function listAwinFeeds(listUrl = process.env.AWIN_FEED_LIST_URL): Promise<AwinFeed[]> {
  if (!listUrl) return [];
  const res = await fetch(listUrl);
  if (!res.ok) throw new Error(`Awin feed list download failed: HTTP ${res.status}`);
  return parseFeedList(decode(Buffer.from(await res.arrayBuffer())));
}

async function download(url: string): Promise<Response> {
  return fetch(url, { headers: { "accept-encoding": "gzip" } });
}

export async function ingestAwinFeed(
  feedUrl: string,
  format: AwinFormat = "awin",
  source = "awin-feed",
  deadline?: number,
): Promise<IngestResult> {
  let res: Response | null = null;
  if (format === "awin") {
    const extended = withExtraColumns(feedUrl);
    if (extended !== feedUrl) {
      res = await download(extended);
      // If Awin refuses a column, fall back to the link exactly as Awin gave it.
      if (!res.ok) res = null;
    }
  }
  res ??= await download(feedUrl);
  if (!res.ok) throw new Error(`Awin feed download failed: HTTP ${res.status}`);
  const text = decode(Buffer.from(await res.arrayBuffer()));
  const header = text.slice(0, 2000).split(/\r?\n/)[0] ?? "";
  // Trust the header over the list's label.
  const google = /(^|,)"?advertiser_name"?(,|$)/.test(header) || (format === "google" && !header.includes("merchant_name"));
  const columns = google ? awinGoogleColumns : awinColumns;
  return ingestRows("awin", source, parseCsv(text, columns), { deadline });
}

export function awinFeedUrls(): string[] {
  return (process.env.AWIN_FEED_URLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
