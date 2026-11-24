import { currentCountry } from "@/lib/request-country";
import { localPath } from "@/lib/countries";
import type { Metadata } from "next";
import Link from "next/link";
import { listMerchants } from "@/lib/catalogue";
import { plural } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shops we compare" };

export default async function MerchantsPage() {
  const c = await currentCountry();
  const merchants = await listMerchants(c.code);
  return (
    <>
      <h1>Shops we compare</h1>
      <p className="lede">
        {plural(merchants.length, `${c.adjective} shop`)} with current offers. Every shop listed delivers to {c.inName}.
      </p>
      <p className="muted">
        Each shop sends us its product feed through the Awin affiliate network, and we refresh prices, delivery and stock
        every day. Shops cannot pay to appear higher. <Link href={localPath(c, "/how-we-rank")}>How we rank</Link>.
      </p>
      <table className="offers" style={{ marginTop: 24 }}>
        <thead>
          <tr>
            <th>Shop</th>
            <th>Website</th>
            <th>Offers</th>
          </tr>
        </thead>
        <tbody>
          {merchants.map((m) => (
            <tr key={m.id}>
              <td>
                <Link href={localPath(c, `/search?merchant=${m.id}`)}>{m.name}</Link>
              </td>
              <td className="muted">{m.domain}</td>
              <td className="num">{m.offers.toLocaleString("en-GB")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
