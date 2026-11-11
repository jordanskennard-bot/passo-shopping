import { beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb, migrate, setDb, type Db } from "@/lib/db";
import { ingestRows, type FeedRow } from "@/lib/ingest";
import { demoRows } from "@/lib/demo";
import { getProduct, listCategories, searchProducts } from "@/lib/catalogue";
import { runCompliance } from "@/lib/compliance";
import { ean13, normaliseGtin, toPence } from "@/lib/normalise";
import { awinColumns, awinGoogleColumns, parseFeedList, withExtraColumns } from "@/lib/feeds/awin";
import { parseCsv } from "@/lib/feeds/csv";

let db: Db;

beforeEach(async () => {
  db = await createPgliteDb();
  await migrate(db);
  setDb(db);
});

const row = (over: Partial<FeedRow>): FeedRow => ({
  merchantName: "Shop A",
  sku: "A1",
  title: "Kestrel Safety Razor",
  pricePence: 3000,
  inStock: true,
  url: "https://www.shop-a.example/razor",
  ...over,
});

describe("normalise", () => {
  it("validates GTIN check digits and pads to 14", () => {
    expect(normaliseGtin("4006381333931")).toBe("04006381333931");
    expect(normaliseGtin("4006381333932")).toBeNull();
    expect(normaliseGtin("0000000000000")).toBeNull();
    expect(normaliseGtin("abc")).toBeNull();
  });
  it("parses prices into pence", () => {
    expect(toPence("12.99")).toBe(1299);
    expect(toPence("£3,50")).toBe(350);
    expect(toPence("")).toBeNull();
  });
});

describe("ingest and matching", () => {
  it("matches offers across merchants by GTIN", async () => {
    await ingestRows("test", "t", [
      row({ gtin: ean13("500000000003") }),
      row({ merchantName: "Shop B", url: "https://shop-b.example/r", sku: "B9", gtin: ean13("500000000003"), pricePence: 2800 }),
    ]);
    const products = await db.query<{ n: number }>("select count(*)::int as n from products");
    expect(products[0].n).toBe(1);
    const merchants = await db.query<{ domain: string }>("select domain from merchants order by domain");
    expect(merchants.map((m) => m.domain)).toEqual(["shop-a.example", "shop-b.example"]);
  });

  it("matches by brand and MPN when there is no GTIN, and never by title alone", async () => {
    await ingestRows("test", "t", [
      row({ brand: "Kestrel", mpn: "KR-01" }),
      row({ merchantName: "Shop B", url: "https://shop-b.example/r", sku: "B1", brand: "KESTREL", mpn: "kr01" }),
      row({ merchantName: "Shop C", url: "https://shop-c.example/r", sku: "C1" }),
    ]);
    const counts = await db.query<{ n: number }>(
      "select count(distinct product_id)::int as n from offers",
    );
    expect(counts[0].n).toBe(2);
  });

  it("re-ingesting updates the offer instead of duplicating it", async () => {
    await ingestRows("test", "t", [row({})]);
    await ingestRows("test", "t", [row({ pricePence: 2500 })]);
    const offers = await db.query<{ price_pence: number }>("select price_pence from offers");
    expect(offers).toEqual([{ price_pence: 2500 }]);
    const products = await db.query<{ n: number }>("select count(*)::int as n from products");
    expect(products[0].n).toBe(1);
  });

  it("rejects bad rows and records them on the feed run", async () => {
    const res = await ingestRows("test", "t", [row({ pricePence: null }), row({ url: "not a url" }), row({})]);
    expect(res.rowsOk).toBe(1);
    expect(res.errors).toBe(2);
    expect(res.errorSample[0]).toMatch(/price/);
  });

  it("hides offers not seen for 48 hours", async () => {
    await ingestRows("test", "t", [row({ gtin: ean13("500000000003") })]);
    await db.query("update offers set last_seen = now() - interval '49 hours'");
    const res = await searchProducts({ q: "razor" });
    expect(res.total).toBe(0);
  });
});

describe("search and product pages", () => {
  beforeEach(async () => {
    await ingestRows("demo", "seed", demoRows(12));
  });

  it("finds products by keyword and sorts by price", async () => {
    const res = await searchProducts({ q: "beans", sort: "price_asc" });
    expect(res.total).toBe(2);
    expect(res.items[0].min_total).toBeLessThanOrEqual(res.items[1].min_total);
    expect(res.brands.map((b) => b.label)).toContain("Moorland Roast");
  });

  it("filters by brand, merchant and free delivery", async () => {
    const brand = await searchProducts({ brand: "kestrel" });
    expect(brand.items.every((i) => i.brand === "Kestrel")).toBe(true);
    const free = await searchProducts({ freeDelivery: true });
    expect(free.total).toBeGreaterThan(0);
    const [m] = await db.query<{ id: number }>("select id from merchants order by id limit 1");
    const one = await searchProducts({ merchant: m.id });
    expect(one.items.every((i) => i.merchant_count === 1)).toBe(true);
  });

  it("product page lists every live offer, cheapest in-stock first", async () => {
    const res = await searchProducts({ q: "grinder" });
    const p = await getProduct(res.items[0].id);
    expect(p).not.toBeNull();
    expect(p!.offers.length).toBeGreaterThan(2);
    const inStock = p!.offers.filter((o) => o.in_stock);
    for (let i = 1; i < inStock.length; i++) {
      expect(inStock[i].total_pence).toBeGreaterThanOrEqual(inStock[i - 1].total_pence);
    }
  });

  it("lists categories with product counts", async () => {
    const cats = await listCategories();
    expect(cats.map((c) => c.slug)).toContain("beard-care");
  });
});

describe("compliance", () => {
  it("fails below 50 merchants and passes at 60", async () => {
    await ingestRows("demo", "seed", demoRows(40));
    let report = await runCompliance();
    expect(report.checks.find((c) => c.id === "merchants")!.status).toBe("fail");
    expect(report.passed).toBe(false);

    await ingestRows("demo", "seed", demoRows(60));
    report = await runCompliance({ save: true });
    expect(report.merchantCount).toBe(60);
    expect(report.checks.find((c) => c.id === "merchants")!.status).toBe("pass");
    expect(report.checks.find((c) => c.id === "search")!.status).toBe("pass");
    const saved = await db.query<{ n: number }>("select count(*)::int as n from compliance_runs");
    expect(saved[0].n).toBe(1);
  });
});

describe("awin adapter", () => {
  it("maps Awin columns and derives the merchant domain from the deep link", async () => {
    const csv = [
      `aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,merchant_category,search_price,merchant_name,merchant_id,brand_name,ean,delivery_cost,in_stock,merchant_deep_link`,
      `https://www.awin1.com/pclick.php?p=1,Kestrel Safety Razor,111,KR1,https://img.example/k.jpg,Shaving,32.00,Shop A,999,Kestrel,${ean13("500000000003")},3.99,1,https://www.shop-a.example/razor`,
    ].join("\n");
    const rows = [];
    for await (const r of parseCsv(csv, awinColumns)) rows.push(r);
    expect(rows[0]).toMatchObject({
      merchantName: "Shop A",
      sku: "KR1",
      gtin: ean13("500000000003"),
      pricePence: 3200,
      deliveryPence: 399,
      inStock: true,
      clickUrl: "https://www.awin1.com/pclick.php?p=1",
    });
    const res = await ingestRows("awin", "test", rows);
    expect(res.rowsOk).toBe(1);
    const [m] = await db.query<{ domain: string }>("select domain from merchants");
    expect(m.domain).toBe("shop-a.example");
  });
});

describe("awin google format and feed list", () => {
  it("reads prices with currency codes, shipping strings and thousands", () => {
    expect(toPence("10.00 GBP")).toBe(1000);
    expect(toPence("GB:::4.99 GBP")).toBe(499);
    expect(toPence("£1,299.00")).toBe(129900);
    expect(toPence("£3,50")).toBe(350);
  });

  it("maps a Google-format row and treats a barcode in the MPN as a GTIN", async () => {
    const code = ean13("505756619866");
    const csv = [
      `advertiser_id,advertiser_name,id,title,link,image_link,aw_deep_link,product_type,gtin,mpn,brand,availability,price,sale_price,shipping`,
      `129953,"Beauti Outlet",4860,"Revlon Lipstick",https://beautioutlet.example/p/1,https://img.example/1.jpg,https://www.awin1.com/pclick.php?p=9,Makeup > Lips,,${code},Revlon,in_stock,3.00 GBP,2.50 GBP,GB:::3.95 GBP`,
      `129953,"Beauti Outlet",4861,"Revlon Gloss",https://beautioutlet.example/p/2,,,Makeup,,ABC-1,Revlon,out_of_stock,2.99 GBP,,`,
    ].join("\n");
    const rows = [];
    for await (const r of parseCsv(csv, awinGoogleColumns)) rows.push(r);
    expect(rows[0]).toMatchObject({ merchantName: "Beauti Outlet", sku: "4860", pricePence: 250, deliveryPence: 395, inStock: true });
    expect(rows[1].inStock).toBe(false);
    const res = await ingestRows("awin", "test", rows);
    expect(res.rowsOk).toBe(2);
    const p = await db.query<{ gtin: string | null; category: string | null }>("select gtin, category from products order by id");
    expect(p[0].gtin).toBe(normaliseGtin(code));
    expect(p[0].category).toBe("Lips");
    expect(p[1].gtin).toBeNull();
  });

  it("keeps only joined UK feeds from the feed list", () => {
    const list = [
      `Advertiser ID,Advertiser Name,Primary Region,Membership Status,Datafeed Format,Feed ID,Feed Name,Language,Vertical,Last Imported,Last Checked,No of products,URL`,
      `"1","Joined UK","GB","active","Google","F1","","English","Retail","","","10","https://ui.awin.example/feed/F1.csv.gz"`,
      `"2","Not joined","GB","Not Joined","Google","F2","","English","Retail","","","10","https://ui.awin.example/feed/F2.csv.gz"`,
      `"3","Joined US","US","active","Awin","3","","English","","","","10","https://productdata.awin.example/x"`,
      `"4","Classic UK","GB","active","Awin","98","Default","English","","","","8896","https://productdata.awin.example/datafeed/download/apikey/K/fid/98/format/csv/columns/merchant_id%2Cean/"`,
    ].join("\n");
    const feeds = parseFeedList(list);
    expect(feeds.map((f) => f.advertiserName)).toEqual(["Joined UK", "Classic UK"]);
    expect(feeds[0].format).toBe("google");
    expect(feeds[1].format).toBe("awin");
  });

  it("adds barcode and delivery columns to a classic link without duplicating", () => {
    const url = "https://productdata.awin.example/datafeed/download/apikey/K/fid/98/format/csv/columns/merchant_id%2Cean/";
    const out = decodeURIComponent(withExtraColumns(url));
    expect(out.endsWith("/columns/merchant_id,ean,product_GTIN,upc,delivery_cost,model_number/")).toBe(true);
    expect(withExtraColumns("https://ui.awin.example/feed/F1.csv.gz")).toBe("https://ui.awin.example/feed/F1.csv.gz");
  });

  it("stops cleanly at a deadline", async () => {
    const res = await ingestRows("awin", "test", [row({}), row({ sku: "A2" })], { deadline: Date.now() - 1 });
    expect(res.rowsIn).toBe(0);
    expect(res.errorSample[0]).toMatch(/time limit/);
  });
});
