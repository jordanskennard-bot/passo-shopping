import { currentCountry } from "@/lib/request-country";
import { localPath } from "@/lib/countries";
import Link from "next/link";
import { catalogueStats, listCategories, listMerchants, searchProducts } from "@/lib/catalogue";
import { plural } from "@/lib/format";
import { ProductGrid } from "@/components/ProductGrid";

export const dynamic = "force-dynamic";

export default async function Home() {
  const c = await currentCountry();
  const [stats, categories, compared, merchants] = await Promise.all([
    catalogueStats(c.code),
    listCategories(c.code),
    searchProducts({ sort: "compared", minMerchants: 2, country: c.code }),
    listMerchants(c.code),
  ]);
  const mostCompared = compared.items.slice(0, 8);

  return (
    <>
      <div className="eyebrow">Price comparison</div>
      <h1>Compare prices from {c.adjective} shops</h1>
      <p className="lede">
        Find the same product across {stats.merchants > 0 ? plural(stats.merchants, `${c.adjective} shop`) : `${c.adjective} shops`} and see each shop's price, with delivery wherever the shop states it. We
        do not sell anything ourselves: every offer links to the shop.
      </p>

      {stats.products > 0 && (
        <p className="muted small">
          {stats.products.toLocaleString("en-GB")} products from {plural(stats.merchants, `${c.adjective} shop`)}, with prices and
          stock refreshed every day. Run a shop? <Link href={localPath(c, "/for-shops")}>Get listed</Link>.
        </p>
      )}

      <hr className="rule" />

      {merchants.length > 0 && (
        <>
          <h2>Shops we compare</h2>
          <ul className="cats">
            {merchants.map((m) => (
              <li key={m.id}>
                <Link href={localPath(c, `/search?merchant=${m.id}`)}>{m.name}</Link> <span className="muted">{m.domain}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">
            <Link href={localPath(c, "/merchants")}>All shops and offer counts</Link> ·{" "}
            <Link href={localPath(c, "/about")}>How the site works</Link>
          </p>
          <hr className="rule" />
        </>
      )}

      {categories.length > 0 && (
        <>
          <h2>Browse by category</h2>
          <ul className="cats">
            {categories.map((cat) => (
              <li key={cat.slug}>
                <Link href={localPath(c, `/category/${cat.slug}`)}>{cat.name}</Link> <span className="muted">({cat.products})</span>
              </li>
            ))}
          </ul>
          <hr className="rule" />
        </>
      )}

      {mostCompared.length > 0 ? (
        <>
          <h2>Most compared</h2>
          <ProductGrid items={mostCompared} country={c} />
        </>
      ) : stats.merchants > 0 ? null : (
        <p className="muted">The catalogue is being loaded. Please check back soon.</p>
      )}
    </>
  );
}
