import Link from "next/link";
import { catalogueStats, listCategories, searchProducts } from "@/lib/catalogue";
import { plural } from "@/lib/format";
import { ProductGrid } from "@/components/ProductGrid";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [stats, categories, compared] = await Promise.all([
    catalogueStats(),
    listCategories(),
    searchProducts({ sort: "compared", minMerchants: 2 }),
  ]);
  const mostCompared = compared.items.slice(0, 8);

  return (
    <>
      <div className="eyebrow">Price comparison</div>
      <h1>Compare prices from UK shops</h1>
      <p className="lede">
        Find the same product across {stats.merchants > 0 ? plural(stats.merchants, "UK shop") : "UK shops"} and see each shop's price, with delivery wherever the shop states it. We
        do not sell anything ourselves: every offer links to the shop.
      </p>

      <hr className="rule" />

      {categories.length > 0 && (
        <>
          <h2>Browse by category</h2>
          <ul className="cats">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`}>{c.name}</Link> <span className="muted">({c.products})</span>
              </li>
            ))}
          </ul>
          <hr className="rule" />
        </>
      )}

      {mostCompared.length > 0 ? (
        <>
          <h2>Most compared</h2>
          <ProductGrid items={mostCompared} />
        </>
      ) : stats.merchants > 0 ? null : (
        <p className="muted">The catalogue is being loaded. Please check back soon.</p>
      )}
    </>
  );
}
