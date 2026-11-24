import { DEFAULT_COUNTRY, localPath, type Country } from "@/lib/countries";
import Link from "next/link";
import type { ProductCard } from "@/lib/catalogue";
import { money, plural } from "@/lib/format";
import { slugify } from "@/lib/normalise";

export function ProductGrid({ items, country = DEFAULT_COUNTRY }: { items: ProductCard[]; country?: Country }) {
  return (
    <div className="grid">
      {items.map((p) => (
        <Link key={p.id} href={localPath(country, `/product/${p.id}-${slugify(p.title)}`)} className="card">
          <div className="thumb">
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" />
            ) : (
              <span className="placeholder" aria-hidden>
                {p.title.slice(0, 1)}
              </span>
            )}
          </div>
          {p.brand && <div className="meta">{p.brand}</div>}
          <div className="title">{p.title}</div>
          <div className="price">From {money(p.min_total, country)}</div>
          {p.cheapest_merchant && <div className="meta">Lowest at {p.cheapest_merchant}</div>}
          <div className="meta">
            {plural(p.merchant_count, "shop")} · {p.delivery_known ? "incl. delivery" : "plus delivery"}
          </div>
        </Link>
      ))}
    </div>
  );
}
