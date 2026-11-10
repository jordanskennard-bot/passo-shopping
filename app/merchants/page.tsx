import type { Metadata } from "next";
import Link from "next/link";
import { listMerchants } from "@/lib/catalogue";
import { plural } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shops we compare" };

export default async function MerchantsPage() {
  const merchants = await listMerchants();
  return (
    <>
      <h1>Shops we compare</h1>
      <p className="lede">
        {plural(merchants.length, "UK shop")} with current offers. Every shop listed delivers to the UK.
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
                <Link href={`/search?merchant=${m.id}`}>{m.name}</Link>
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
