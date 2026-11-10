import { getDb, type Db } from "./db";
import { rules, site } from "./config";

/** Offers count as live when seen recently, from an active merchant, in the site's country. */
const LIVE = `
  select o.* from offers o join merchants m on m.id = o.merchant_id
  where m.status = 'active' and o.country = $1
    and o.last_seen > now() - make_interval(hours => ${rules.offerMaxAgeHours})`;

export type Sort = "relevance" | "price_asc" | "price_desc";

export interface SearchParams {
  q?: string | null;
  category?: string | null;
  brand?: string | null;
  merchant?: number | null;
  freeDelivery?: boolean;
  sort?: Sort;
  page?: number;
}

export interface ProductCard {
  id: number;
  title: string;
  brand: string | null;
  image_url: string | null;
  category: string | null;
  min_total: number;
  offer_count: number;
  merchant_count: number;
}

export interface Facet {
  key: string;
  label: string;
  count: number;
}

export interface SearchResult {
  items: ProductCard[];
  total: number;
  page: number;
  pages: number;
  brands: Facet[];
  merchants: Facet[];
}

const ORDER: Record<Sort, string> = {
  relevance: "rank desc, a.merchant_count desc, a.min_total asc",
  price_asc: "a.min_total asc, p.id",
  price_desc: "a.min_total desc, p.id",
};

export async function searchProducts(params: SearchParams, dbIn?: Db): Promise<SearchResult> {
  const db = dbIn ?? (await getDb());
  const q = params.q?.trim() || null;
  const sort: Sort = params.sort && ORDER[params.sort] ? params.sort : q ? "relevance" : "price_asc";
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const args = [
    site.country,
    q,
    params.category ?? null,
    params.brand ?? null,
    params.merchant ?? null,
    params.freeDelivery === true,
    rules.pageSize,
    (page - 1) * rules.pageSize,
  ];

  const base = `
    with live as (${LIVE}),
    agg as (
      select product_id,
        min(price_pence + coalesce(delivery_pence, 0))::int as min_total,
        count(*)::int as offer_count,
        count(distinct merchant_id)::int as merchant_count
      from live
      where ($6::boolean is not true or delivery_pence = 0)
        and ($5::int is null or merchant_id = $5::int)
      group by product_id
    ),
    matched as (
      select p.*, a.min_total, a.offer_count, a.merchant_count,
        case when $2::text is null then 0
             else ts_rank(p.search, websearch_to_tsquery('english', $2::text)) end as rank
      from products p join agg a on a.product_id = p.id
      where ($2::text is null or p.search @@ websearch_to_tsquery('english', $2::text))
        and ($3::text is null or p.category_slug = $3::text)
        and ($4::text is null or p.brand_key = $4::text)
    )`;

  const items = await db.query<ProductCard & { total: number }>(
    `${base}
     select p.id::int as id, p.title, p.brand, p.image_url, p.category, p.min_total, p.offer_count,
            p.merchant_count, count(*) over ()::int as total
     from matched p join agg a on a.product_id = p.id
     order by ${ORDER[sort]}
     limit $7 offset $8`,
    args,
  );

  const facetArgs = args.slice(0, 6);
  const facetBase = base.replace(/\$7|\$8/g, "null");
  const brands = await db.query<Facet>(
    `${facetBase}
     select brand_key as key, min(brand) as label, count(*)::int as count
     from matched where brand_key is not null
     group by brand_key order by count desc, label limit 20`,
    facetArgs,
  );
  const merchants = await db.query<Facet>(
    `${facetBase}
     select m.id::text as key, m.name as label, count(distinct l.product_id)::int as count
     from live l join matched p on p.id = l.product_id join merchants m on m.id = l.merchant_id
     group by m.id, m.name order by count desc, label limit 20`,
    facetArgs,
  );

  const total = items[0]?.total ?? 0;
  return {
    items: items.map(({ total: _t, ...rest }) => rest),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / rules.pageSize)),
    brands,
    merchants,
  };
}

export interface Offer {
  id: number;
  merchant_id: number;
  merchant_name: string;
  merchant_domain: string;
  title: string;
  price_pence: number;
  delivery_pence: number | null;
  total_pence: number;
  in_stock: boolean;
  click_url: string;
  last_seen: string;
}

export interface ProductDetail {
  id: number;
  title: string;
  brand: string | null;
  gtin: string | null;
  category: string | null;
  category_slug: string | null;
  image_url: string | null;
  offers: Offer[];
}

export async function getProduct(id: number, dbIn?: Db): Promise<ProductDetail | null> {
  const db = dbIn ?? (await getDb());
  const [p] = await db.query<Omit<ProductDetail, "offers">>(
    "select id::int as id, title, brand, gtin, category, category_slug, image_url from products where id = $1",
    [id],
  );
  if (!p) return null;
  const offers = await db.query<Offer>(
    `with live as (${LIVE})
     select l.id::int as id, l.merchant_id, m.name as merchant_name, m.domain as merchant_domain, l.title,
            l.price_pence, l.delivery_pence, (l.price_pence + coalesce(l.delivery_pence, 0))::int as total_pence,
            l.in_stock, l.click_url, l.last_seen::text as last_seen
     from live l join merchants m on m.id = l.merchant_id
     where l.product_id = $2
     order by l.in_stock desc, total_pence asc, m.name`,
    [site.country, id],
  );
  if (offers.length === 0) return null;
  return { ...p, offers };
}

export interface Category {
  slug: string;
  name: string;
  products: number;
}

export async function listCategories(dbIn?: Db): Promise<Category[]> {
  const db = dbIn ?? (await getDb());
  return db.query<Category>(
    `with live as (${LIVE})
     select p.category_slug as slug, min(p.category) as name, count(distinct p.id)::int as products
     from products p join live l on l.product_id = p.id
     where p.category_slug is not null
     group by p.category_slug order by products desc, name`,
    [site.country],
  );
}

export interface MerchantRow {
  id: number;
  name: string;
  domain: string;
  offers: number;
}

export async function listMerchants(dbIn?: Db): Promise<MerchantRow[]> {
  const db = dbIn ?? (await getDb());
  return db.query<MerchantRow>(
    `with live as (${LIVE})
     select m.id, m.name, m.domain, count(l.id)::int as offers
     from merchants m join live l on l.merchant_id = m.id
     where $1 = any(m.delivers_to)
     group by m.id, m.name, m.domain order by m.name`,
    [site.country],
  );
}

export async function catalogueStats(dbIn?: Db) {
  const db = dbIn ?? (await getDb());
  const [s] = await db.query<{ merchants: number; products: number; offers: number; comparable: number }>(
    `with live as (${LIVE}),
     per as (select product_id, count(distinct merchant_id) as n from live group by product_id)
     select
       (select count(distinct l.merchant_id) from live l join merchants m on m.id = l.merchant_id
          where $1 = any(m.delivers_to))::int as merchants,
       (select count(*) from per)::int as products,
       (select count(*) from live)::int as offers,
       (select count(*) from per where n >= 2)::int as comparable`,
    [site.country],
  );
  return s;
}
