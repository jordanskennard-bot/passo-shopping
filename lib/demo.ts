import type { Db } from "./db";
import { ingestRows, type FeedRow } from "./ingest";
import { ean13 } from "./normalise";

/**
 * Invented catalogue for the local demo (npm run dev:demo) and tests only.
 * Never loaded in production: getDb() refuses PGlite when NODE_ENV is production.
 * Merchant domains use the reserved .example top-level domain.
 */
export function demoRows(merchantCount = 60): FeedRow[] {
  const products = [
    { gtin: ean13("500000000001"), brand: "Northfield", title: "Northfield Beard Oil 30ml", category: "Grooming > Beard care", base: 1200 },
    { gtin: ean13("500000000002"), brand: "Northfield", title: "Northfield Beard Balm 60g", category: "Grooming > Beard care", base: 1400 },
    { gtin: ean13("500000000003"), brand: "Kestrel", title: "Kestrel Safety Razor", category: "Grooming > Shaving", base: 3200 },
    { gtin: ean13("500000000004"), brand: "Kestrel", title: "Kestrel Shaving Soap 100g", category: "Grooming > Shaving", base: 900 },
    { gtin: ean13("500000000005"), brand: "Moorland Roast", title: "Moorland Roast House Blend Beans 1kg", category: "Coffee > Beans", base: 2400 },
    { gtin: ean13("500000000006"), brand: "Moorland Roast", title: "Moorland Roast Decaf Beans 250g", category: "Coffee > Beans", base: 850 },
    { gtin: ean13("500000000007"), brand: "Ouse", title: "Ouse Pour Over Kettle 1L", category: "Coffee > Equipment", base: 4500 },
    { gtin: ean13("500000000008"), brand: "Ouse", title: "Ouse Burr Grinder", category: "Coffee > Equipment", base: 8900 },
    { gtin: ean13("500000000009"), brand: "Dalesman", title: "Dalesman Grain Free Dog Food 12kg", category: "Pet > Dog food", base: 5200 },
    { gtin: ean13("500000000010"), brand: "Dalesman", title: "Dalesman Puppy Food 2kg", category: "Pet > Dog food", base: 1600 },
    { gtin: ean13("500000000011"), brand: "Vale", title: "Vale Vitamin D3 120 tablets", category: "Health > Vitamins", base: 799 },
    { gtin: ean13("500000000012"), brand: "Vale", title: "Vale Magnesium 90 capsules", category: "Health > Vitamins", base: 1099 },
  ];
  const rows: FeedRow[] = [];
  for (let m = 1; m <= merchantCount; m++) {
    const domain = `shop${String(m).padStart(2, "0")}.example`;
    products.forEach((p, i) => {
      if ((m + i) % 3 === 0) return; // not every shop stocks everything
      const swing = ((m * 37 + i * 11) % 21) - 10; // -10% to +10%
      rows.push({
        merchantName: `Demo Shop ${m}`,
        merchantDomain: domain,
        sku: `D${m}-${i}`,
        gtin: p.gtin,
        brand: p.brand,
        title: p.title,
        category: p.category,
        imageUrl: null,
        pricePence: Math.round(p.base * (1 + swing / 100)),
        deliveryPence: m % 4 === 0 ? 0 : 399,
        inStock: (m + i) % 11 !== 0,
        url: `https://${domain}/products/${i + 1}`,
      });
    });
  }
  return rows;
}

export async function seedDemo(db: Db, merchantCount = 60) {
  await ingestRows("demo", "demo-seed", demoRows(merchantCount), { db });
}
