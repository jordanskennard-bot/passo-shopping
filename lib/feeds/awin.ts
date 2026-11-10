import { decode, parseCsv, type ColumnMap } from "./csv";
import { ingestRows, type IngestResult } from "../ingest";

/**
 * Awin product feed adapter.
 *
 * Feed URLs come from Awin's "Create-a-Feed" tool and embed the publisher API
 * key, so they live only in the AWIN_FEED_URLS environment variable (comma
 * separated). Choose CSV, gzip, and include the columns below.
 *
 * VERIFY against the first real feed: Awin column names have changed before.
 * Candidates are listed in order and the first non-empty one wins.
 */
export const awinColumns: ColumnMap = {
  merchantName: ["merchant_name"],
  merchantDomain: [],
  networkMerchantId: ["merchant_id"],
  sku: ["merchant_product_id", "aw_product_id"],
  gtin: ["ean", "product_GTIN", "upc", "isbn"],
  brand: ["brand_name"],
  mpn: ["mpn", "model_number"],
  title: ["product_name"],
  category: ["merchant_category", "category_name"],
  imageUrl: ["merchant_image_url", "aw_image_url", "large_image"],
  pricePence: ["search_price", "store_price"],
  deliveryPence: ["delivery_cost"],
  inStock: ["in_stock"],
  url: ["merchant_deep_link"],
  clickUrl: ["aw_deep_link"],
};

export async function ingestAwinFeed(feedUrl: string): Promise<IngestResult> {
  const res = await fetch(feedUrl, { headers: { "accept-encoding": "gzip" } });
  if (!res.ok) throw new Error(`Awin feed download failed: HTTP ${res.status}`);
  const text = decode(Buffer.from(await res.arrayBuffer()));
  // Never log the URL: it contains the API key.
  return ingestRows("awin", "awin-feed", parseCsv(text, awinColumns));
}

export function awinFeedUrls(): string[] {
  return (process.env.AWIN_FEED_URLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
