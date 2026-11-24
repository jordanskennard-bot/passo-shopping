import type { FeedRow } from "../ingest";
import { ingestRows, type IngestResult } from "../ingest";
import { toPence } from "../normalise";

/**
 * Shopify stores that have agreed to be listed (Passo clients, app installs,
 * our own Foul Play). Reads the store's public /products.json, page by page.
 * It has no delivery cost, so offers show "plus delivery" unless the entry
 * sets a flat delivery price. Only add a store with its owner's permission.
 *
 * Configured in DIRECT_FEEDS with "type": "shopify":
 * [{"type":"shopify","name":"Foul Play","domain":"shop.foulplay.games","url":"https://shop.foulplay.games","deliveryPence":399}]
 */
interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  sku: string | null;
  barcode?: string | null;
  available: boolean;
}
interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor: string | null;
  product_type: string | null;
  images: { src: string }[];
  variants: ShopifyVariant[];
}

export interface ShopifyStore {
  name: string;
  domain?: string | null;
  url: string;
  deliveryPence?: number | null;
  country?: string;
}

export function shopifyRows(products: ShopifyProduct[], store: ShopifyStore): FeedRow[] {
  const base = store.url.replace(/\/+$/, "");
  const rows: FeedRow[] = [];
  for (const p of products) {
    for (const v of p.variants ?? []) {
      const single = (p.variants?.length ?? 0) <= 1 || v.title === "Default Title";
      rows.push({
        merchantName: store.name,
        merchantDomain: store.domain ?? null,
        sku: v.sku?.trim() || String(v.id),
        gtin: v.barcode?.trim() || null,
        brand: p.vendor?.trim() || null,
        title: single ? p.title : `${p.title} - ${v.title}`,
        category: p.product_type?.trim() || null,
        imageUrl: p.images?.[0]?.src ?? null,
        pricePence: toPence(v.price),
        deliveryPence: store.deliveryPence ?? null,
        inStock: !!v.available,
        url: `${base}/products/${p.handle}${single ? "" : `?variant=${v.id}`}`,
        clickUrl: null,
      });
    }
  }
  return rows;
}

async function* fetchAll(store: ShopifyStore): AsyncGenerator<FeedRow> {
  const base = store.url.replace(/\/+$/, "");
  for (let page = 1; page <= 100; page++) {
    const res = await fetch(`${base}/products.json?limit=250&page=${page}`);
    if (!res.ok) throw new Error(`Shopify products download failed: HTTP ${res.status}`);
    const { products } = (await res.json()) as { products: ShopifyProduct[] };
    if (!products?.length) return;
    yield* shopifyRows(products, store);
    if (products.length < 250) return;
  }
}

export async function ingestShopifyStore(store: ShopifyStore, source: string, deadline?: number): Promise<IngestResult> {
  return ingestRows("direct", source, fetchAll(store), { deadline, country: store.country });
}
