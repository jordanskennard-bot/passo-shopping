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

describe("home page helpers", () => {
  it("lists only products sold by two or more shops, most shops first, and flags unknown delivery", async () => {
    const g1 = ean13("500000000101");
    await ingestRows("test", "test", [
      row({ merchantName: "Shop A", url: "https://a.example/1", sku: "1", gtin: g1, deliveryPence: null }),
      row({ merchantName: "Shop B", url: "https://b.example/1", sku: "1", gtin: g1, deliveryPence: 0 }),
      row({ merchantName: "Shop A", url: "https://a.example/2", sku: "2", title: "Single shop thing" }),
    ]);
    const res = await searchProducts({ sort: "compared", minMerchants: 2 });
    expect(res.items.map((i) => i.merchant_count)).toEqual([2]);
    expect(res.items[0].delivery_known).toBe(false);
    expect(res.total).toBe(1);
    const all = await searchProducts({});
    expect(all.total).toBe(2);
  });
});

describe("product cards", () => {
  it("name the shop with the lowest in-stock total", async () => {
    const g = ean13("500000000010");
    await ingestRows("test", "t", [
      row({ gtin: g, pricePence: 3000 }),
      row({ merchantName: "Shop B", url: "https://shop-b.example/r", sku: "B1", gtin: g, pricePence: 2500 }),
      row({ merchantName: "Shop C", url: "https://shop-c.example/r", sku: "C1", gtin: g, pricePence: 2000, inStock: false }),
    ]);
    const res = await searchProducts({});
    expect(res.items[0].cheapest_merchant).toBe("Shop B");
  });
});

describe("webgains and direct feeds", () => {
  const collect = async (gen: AsyncGenerator<FeedRow>) => {
    const out: FeedRow[] = [];
    for await (const r of gen) out.push(r);
    return out;
  };

  it("reads a Google RSS feed with nested shipping and tags the merchant", async () => {
    const { parseGoogleFeed } = await import("@/lib/feeds/google");
    const xml = `<?xml version="1.0"?><rss xmlns:g="http://base.google.com/ns/1.0" version="2.0"><channel>
      <item><g:id>S1</g:id><g:title>Kestrel Razor</g:title><g:link>https://www.kestrel.example/razor</g:link>
      <g:price>30.00 GBP</g:price><g:sale_price>25.00 GBP</g:sale_price><g:availability>in stock</g:availability>
      <g:gtin>${ean13("500000000027")}</g:gtin><g:brand>Kestrel</g:brand>
      <g:shipping><g:country>GB</g:country><g:price>3.95 GBP</g:price></g:shipping></item>
      <item><g:id>S2</g:id><g:title>Blades</g:title><g:link>https://www.kestrel.example/blades</g:link>
      <g:price>5.00 GBP</g:price><g:availability>out of stock</g:availability></item>
    </channel></rss>`;
    const rows = await collect(parseGoogleFeed(Buffer.from(xml), { name: "Kestrel", domain: null }));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ merchantName: "Kestrel", sku: "S1", pricePence: 2500, deliveryPence: 395, inStock: true });
    expect(rows[1].inStock).toBe(false);
    const r = await ingestRows("direct", "t", rows);
    expect(r.rowsOk).toBe(2);
  });

  it("reads a Google TSV feed", async () => {
    const { parseGoogleFeed } = await import("@/lib/feeds/google");
    const tsv = "id\ttitle\tlink\tprice\tavailability\nT1\tSoap\thttps://soap.example/p\t4.50 GBP\tin stock\n";
    const rows = await collect(parseGoogleFeed(Buffer.from(tsv), { name: "Soap Co", domain: "soap.example" }));
    expect(rows[0]).toMatchObject({ title: "Soap", pricePence: 450, merchantDomain: "soap.example" });
  });

  it("reads a classic Webgains CSV, using the configured domain behind tracked links", async () => {
    const { parseWebgainsFeed } = await import("@/lib/feeds/webgains");
    const csv =
      "program_name,program_id,product_id,product_name,deeplink,price,delivery_cost,image_url,category_name,ean,brand\n" +
      `Lamp Shop,123,L1,Desk Lamp,https://track.webgains.com/click.html?x=1,19.99,2.99,https://img.example/l.jpg,Lighting,${ean13("500000000034")},Lumo\n`;
    const rows = await collect(parseWebgainsFeed(Buffer.from(csv), { name: "Lamp Shop", domain: "lampshop.example" }));
    expect(rows[0]).toMatchObject({ merchantDomain: "lampshop.example", pricePence: 1999, deliveryPence: 299, sku: "L1" });
    expect(rows[0].clickUrl).toContain("webgains");
    const r = await ingestRows("webgains", "t", rows);
    expect(r.rowsOk).toBe(1);
    const m = await db.query<{ domain: string }>("select domain from merchants");
    expect(m.map((x) => x.domain)).toEqual(["lampshop.example"]);
  });

  it("parses feed config and drops Webgains entries without a domain", async () => {
    const { webgainsFeeds } = await import("@/lib/feeds/webgains");
    const { directFeeds } = await import("@/lib/feeds/direct");
    const raw = JSON.stringify([
      { name: "A", domain: "a.example", url: "https://feeds.example/a" },
      { name: "B", url: "https://feeds.example/b" },
      { name: "C", url: "http://insecure.example/c" },
    ]);
    expect(webgainsFeeds(raw).map((f) => f.name)).toEqual(["A"]);
    expect(directFeeds(raw).map((f) => f.name)).toEqual(["A", "B"]);
    expect(directFeeds("")).toEqual([]);
    expect(() => directFeeds("{not json")).toThrow();
  });
});

describe("shopify direct stores", () => {
  it("turns products.json variants into offers with variant links", async () => {
    const { shopifyRows } = await import("@/lib/feeds/shopify");
    const rows = shopifyRows(
      [
        {
          id: 1, title: "Party Game", handle: "party-game", vendor: "Foul Play", product_type: "Games",
          images: [{ src: "https://cdn.example/g.jpg" }],
          variants: [{ id: 11, title: "Default Title", price: "10.00", sku: "FP1", barcode: ean13("500000000041"), available: true }],
        },
        {
          id: 2, title: "Tee", handle: "tee", vendor: "Foul Play", product_type: null, images: [],
          variants: [
            { id: 21, title: "S", price: "15.00", sku: "", available: true },
            { id: 22, title: "M", price: "15.00", sku: null, available: false },
          ],
        },
      ],
      { name: "Foul Play", domain: "shop.foulplay.example", url: "https://shop.foulplay.example/", deliveryPence: 399 },
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ title: "Party Game", url: "https://shop.foulplay.example/products/party-game", pricePence: 1000, deliveryPence: 399 });
    expect(rows[1]).toMatchObject({ title: "Tee - S", sku: "21", url: "https://shop.foulplay.example/products/tee?variant=21" });
    expect(rows[2].inStock).toBe(false);
    const r = await ingestRows("direct", "t", rows);
    expect(r.rowsOk).toBe(3);
  });
});

describe("countries", () => {
  it("parses COUNTRIES, keeps the UK first and maps paths", async () => {
    const { enabledCountries, countryForPath, localPath, COUNTRIES } = await import("@/lib/countries");
    expect(enabledCountries(undefined).map((c) => c.code)).toEqual(["GB"]);
    expect(enabledCountries("ie, xx").map((c) => c.code)).toEqual(["GB", "IE"]);
    expect(countryForPath("/ie/merchants", "GB,IE")?.code).toBe("IE");
    expect(countryForPath("/ie", "GB,IE")?.code).toBe("IE");
    expect(countryForPath("/ie/merchants", "GB")).toBeNull();
    expect(countryForPath("/iexample", "GB,IE")).toBeNull();
    expect(localPath(COUNTRIES.IE, "/")).toBe("/ie");
    expect(localPath(COUNTRIES.IE, "/search?q=x")).toBe("/ie/search?q=x");
    expect(localPath(COUNTRIES.GB, "/search")).toBe("/search");
  });

  it("keeps each country's offers apart and records where a shop delivers", async () => {
    const g = ean13("500000000058");
    await ingestRows("awin", "uk", [row({ gtin: g, pricePence: 2000 })], { country: "GB" });
    await ingestRows("awin", "ie", [row({ gtin: g, pricePence: 2400, sku: "A1-IE" })], { country: "IE" });
    await ingestRows("awin", "ie", [row({ merchantName: "Irish Only", url: "https://irish.example/p", sku: "I1", gtin: g, pricePence: 2300 })], { country: "IE" });

    const merchants = await db.query<{ domain: string; delivers_to: string[] }>(
      "select domain, delivers_to from merchants order by domain",
    );
    expect(merchants).toEqual([
      { domain: "irish.example", delivers_to: ["IE"] },
      { domain: "shop-a.example", delivers_to: ["GB", "IE"] },
    ]);
    const cur = await db.query<{ country: string; currency: string }>("select distinct country, currency from offers order by country");
    expect(cur).toEqual([{ country: "GB", currency: "GBP" }, { country: "IE", currency: "EUR" }]);

    const uk = await searchProducts({});
    expect(uk.items[0]).toMatchObject({ merchant_count: 1, min_total: 2000 });
    const ie = await searchProducts({ country: "IE" });
    expect(ie.items[0]).toMatchObject({ merchant_count: 2, min_total: 2300 });
    const p = await getProduct(ie.items[0].id, "IE");
    expect(p?.offers.map((o) => o.price_pence)).toEqual([2300, 2400]);

    const { COUNTRIES } = await import("@/lib/countries");
    const report = await runCompliance({ country: COUNTRIES.IE });
    expect(report.country).toBe("IE");
    expect(report.checks[0].detail).toContain("2 merchants with live Irish offers");
    expect(report.checks[0].requirement).toContain("delivering to Ireland");
  });

  it("formats money in the country's currency", async () => {
    const { money } = await import("@/lib/format");
    const { COUNTRIES } = await import("@/lib/countries");
    expect(money(1999)).toBe("£19.99");
    expect(money(1999, COUNTRIES.IE)).toBe("€19.99");
  });

  it("reads Irish feeds from the Awin feed list only when Ireland is enabled", () => {
    const list = [
      `"Advertiser ID","Advertiser Name","Primary Region","Membership Status","Feed ID","Feed Name","Language","Vertical","Last Imported","Last Checked","No of products","URL","Datafeed Format"`,
      `"1","UK Shop","GB","active","10","F","English","","","","5","https://feeds.example/1",""`,
      `"2","Irish Shop","IE","active","20","F","English","","","","5","https://feeds.example/2",""`,
      `"3","German Shop","DE","active","30","F","German","","","","5","https://feeds.example/3",""`,
    ].join("\n");
    expect(parseFeedList(list).map((f) => f.advertiserName)).toEqual(["UK Shop"]);
    const both = parseFeedList(list, ["GB", "IE"]);
    expect(both.map((f) => [f.advertiserName, f.country])).toEqual([["UK Shop", "GB"], ["Irish Shop", "IE"]]);
  });
});
