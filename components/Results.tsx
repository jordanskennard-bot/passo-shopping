import Link from "next/link";
import { searchProducts, type SearchParams, type Sort } from "@/lib/catalogue";
import { plural } from "@/lib/format";
import { ProductGrid } from "./ProductGrid";

type Raw = Record<string, string | string[] | undefined>;

export function readParams(raw: Raw): SearchParams {
  const one = (k: string) => (Array.isArray(raw[k]) ? raw[k]![0] : (raw[k] as string | undefined)) || null;
  const merchant = Number(one("merchant"));
  return {
    q: one("q"),
    brand: one("brand"),
    merchant: Number.isInteger(merchant) && merchant > 0 ? merchant : null,
    freeDelivery: one("free") === "1",
    sort: (one("sort") as Sort) ?? undefined,
    page: Number(one("page")) || 1,
  };
}

function href(base: string, params: SearchParams, change: Partial<SearchParams>) {
  const p = { ...params, ...change };
  const qs = new URLSearchParams();
  if (p.q) qs.set("q", p.q);
  if (p.brand) qs.set("brand", p.brand);
  if (p.merchant) qs.set("merchant", String(p.merchant));
  if (p.freeDelivery) qs.set("free", "1");
  if (p.sort) qs.set("sort", p.sort);
  if (p.page && p.page > 1) qs.set("page", String(p.page));
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

export async function Results({ base, params }: { base: string; params: SearchParams }) {
  const res = await searchProducts(params);
  const sort = params.sort ?? (params.q ? "relevance" : "price_asc");
  const sorts: [Sort, string][] = [
    ...(params.q ? ([["relevance", "Best match"]] as [Sort, string][]) : []),
    ["price_asc", "Price, low to high"],
    ["price_desc", "Price, high to low"],
  ];

  return (
    <div className="layout">
      <aside className="filters" aria-label="Filters">
        <h3>Delivery</h3>
        <ul>
          <li>
            <Link
              className={params.freeDelivery ? "on" : ""}
              href={href(base, params, { freeDelivery: !params.freeDelivery, page: 1 })}
            >
              {params.freeDelivery ? "✓ " : ""}Free delivery only
            </Link>
          </li>
        </ul>
        {res.brands.length > 0 && (
          <>
            <h3>Brand</h3>
            <ul>
              {params.brand && (
                <li>
                  <Link href={href(base, params, { brand: null, page: 1 })}>← All brands</Link>
                </li>
              )}
              {res.brands.map((b) => (
                <li key={b.key}>
                  <Link
                    className={params.brand === b.key ? "on" : ""}
                    href={href(base, params, { brand: b.key, page: 1 })}
                  >
                    {b.label} <span className="muted">({b.count})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
        {res.merchants.length > 0 && (
          <>
            <h3>Shop</h3>
            <ul>
              {params.merchant && (
                <li>
                  <Link href={href(base, params, { merchant: null, page: 1 })}>← All shops</Link>
                </li>
              )}
              {res.merchants.slice(0, 12).map((m) => (
                <li key={m.key}>
                  <Link
                    className={String(params.merchant) === m.key ? "on" : ""}
                    href={href(base, params, { merchant: Number(m.key), page: 1 })}
                  >
                    {m.label} <span className="muted">({m.count})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
      <section>
        <div className="toolbar">
          <div>{plural(res.total, "product")}</div>
          <div className="sorts">
            Sort:
            {sorts.map(([key, label]) => (
              <Link key={key} className={sort === key ? "on" : ""} href={href(base, params, { sort: key, page: 1 })}>
                {label}
              </Link>
            ))}
          </div>
        </div>
        {res.total === 0 ? (
          <p className="muted">No products match. Try a shorter search or remove a filter.</p>
        ) : (
          <ProductGrid items={res.items} />
        )}
        {res.pages > 1 && (
          <div className="pager">
            {res.page > 1 && <Link href={href(base, params, { page: res.page - 1 })}>← Previous</Link>}
            <span className="muted">
              Page {res.page} of {res.pages}
            </span>
            {res.page < res.pages && <Link href={href(base, params, { page: res.page + 1 })}>Next →</Link>}
          </div>
        )}
      </section>
    </div>
  );
}
