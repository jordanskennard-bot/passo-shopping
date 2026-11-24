import { parseGoogleFeed } from "./google";
import { parseFeedConfig, type WebgainsFeed } from "./webgains";
import { ingestRows, type IngestResult } from "../ingest";
import { ingestShopifyStore } from "./shopify";

/**
 * Direct feeds: shops (Passo clients, Shopify app installs, brands we know)
 * that give us their Google Shopping feed without an affiliate network.
 * Links go straight to the shop, untracked.
 *
 * Configured in DIRECT_FEEDS as JSON: [{"name":"Shop","domain":"shop.co.uk","url":"https://..."}].
 * Domain is optional; the product links identify the shop. Add "type": "shopify" to read a
 * Shopify store's public product list instead of a Google feed (see shopify.ts).
 */
export type DirectFeed = WebgainsFeed;

export function directFeeds(raw = process.env.DIRECT_FEEDS): DirectFeed[] {
  return parseFeedConfig(raw);
}

export async function ingestDirectFeed(feed: DirectFeed, source: string, deadline?: number): Promise<IngestResult> {
  if (feed.type === "shopify") return ingestShopifyStore(feed, source, deadline);
  const res = await fetch(feed.url, { headers: { "accept-encoding": "gzip" } });
  if (!res.ok) throw new Error(`Direct feed download failed: HTTP ${res.status}`);
  return ingestRows("direct", source, parseGoogleFeed(Buffer.from(await res.arrayBuffer()), feed), {
    deadline,
    country: feed.country,
  });
}
