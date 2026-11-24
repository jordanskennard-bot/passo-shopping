import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { listStores } from "@/lib/direct-stores";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Direct shop requests", robots: { index: false, follow: false } };

export default async function StoresPage() {
  const stores = await listStores(await getDb());
  return (
    <>
      <div className="eyebrow">Internal</div>
      <h1>Shops asking to be listed</h1>
      <p className="lede">
        Approve only after checking the shop is real, delivers to the country, and the feed opens. Approved shops load in
        the next nightly run.
      </p>
      {stores.length === 0 ? (
        <p className="muted">No requests yet.</p>
      ) : (
        <table className="offers">
          <thead>
            <tr>
              <th>Shop</th>
              <th>Feed</th>
              <th>Country</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong style={{ fontWeight: 500 }}>{s.name}</strong>
                  <div className="muted small">
                    {s.domain} · {s.contactEmail} · {s.createdAt.slice(0, 10)}
                  </div>
                </td>
                <td className="small">
                  {s.type === "shopify" ? "Shopify store" : "Google feed"}
                  <div className="muted" style={{ wordBreak: "break-all" }}>{s.url}</div>
                </td>
                <td>{s.country}</td>
                <td>
                  <span className={`status ${s.status === "active" ? "pass" : s.status === "rejected" ? "fail" : "warn"}`}>
                    {s.status}
                  </span>
                </td>
                <td>
                  {s.status !== "active" && (
                    <form method="post" action="/internal/stores/action" style={{ display: "inline" }}>
                      <input type="hidden" name="id" value={s.id} />
                      <button name="decision" value="active">Approve</button>
                    </form>
                  )}{" "}
                  {s.status !== "rejected" && (
                    <form method="post" action="/internal/stores/action" style={{ display: "inline" }}>
                      <input type="hidden" name="id" value={s.id} />
                      <button name="decision" value="rejected">Reject</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
