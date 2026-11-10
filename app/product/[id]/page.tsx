import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/catalogue";
import { delivery, money, plural } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function idFrom(raw: string): number | null {
  const n = Number(raw.split("-")[0]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = idFrom((await params).id);
  const p = id ? await getProduct(id) : null;
  if (!p) return { title: "Product not found" };
  return {
    title: `${p.title}: compare ${plural(new Set(p.offers.map((o) => o.merchant_id)).size, "shop")}`,
    description: `Prices for ${p.title} from ${money(p.offers[0].total_pence)} including delivery.`,
  };
}

export default async function ProductPage({ params }: Props) {
  const id = idFrom((await params).id);
  const p = id ? await getProduct(id) : null;
  if (!p) notFound();
  const shops = new Set(p.offers.map((o) => o.merchant_id)).size;
  const cheapest = p.offers.find((o) => o.in_stock) ?? p.offers[0];

  return (
    <>
      {p.category && p.category_slug && (
        <div className="eyebrow">
          <Link href={`/category/${p.category_slug}`}>{p.category}</Link>
        </div>
      )}
      <div className="product">
        <div className="thumb">
          {p.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image_url} alt={p.title} referrerPolicy="no-referrer" />
          ) : (
            <span className="muted" style={{ fontFamily: "var(--serif)", fontSize: "3rem" }} aria-hidden>
              {p.title.slice(0, 1)}
            </span>
          )}
        </div>
        <div>
          {p.brand && <div className="muted">{p.brand}</div>}
          <h1>{p.title}</h1>
          <p className="lede">
            {plural(shops, "shop")} selling this product. Best total price {money(cheapest.total_pence)} including
            delivery.
          </p>
          {p.gtin && <p className="muted small">Barcode (GTIN) {p.gtin.replace(/^0+(?=\d{13})/, "")}</p>}
        </div>
      </div>

      <hr className="rule" />
      <h2>Compare prices</h2>
      <table className="offers">
        <thead>
          <tr>
            <th>Shop</th>
            <th className="hide-sm">Price</th>
            <th className="hide-sm">Delivery</th>
            <th>Total</th>
            <th>
              <span style={{ position: "absolute", left: "-9999px" }}>Link</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {p.offers.map((o, i) => (
            <tr key={o.id}>
              <td>
                <strong style={{ fontWeight: 500 }}>{o.merchant_name}</strong>
                <div className="muted small">
                  {o.merchant_domain}
                  {!o.in_stock && <span className="out"> · Out of stock</span>}
                </div>
              </td>
              <td className="num hide-sm">{money(o.price_pence)}</td>
              <td className="num hide-sm">{delivery(o.delivery_pence)}</td>
              <td className="num">
                <span className="total">{money(o.total_pence)}</span>
                {i === 0 && o.in_stock && <span className="best">Lowest total</span>}
              </td>
              <td style={{ textAlign: "right" }}>
                <a className="go" href={o.click_url} rel="sponsored nofollow noopener" target="_blank">
                  Go to shop →
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small" style={{ marginTop: 16 }}>
        Prices and delivery come from each shop&apos;s product feed and are checked daily. The shop&apos;s own page has the
        final price. We may be paid when you visit a shop from this page; this never changes the order, which is by
        total price. <Link href="/how-we-rank">How we rank</Link>.
      </p>
    </>
  );
}
