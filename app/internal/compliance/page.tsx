import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { runCompliance } from "@/lib/compliance";
import { catalogueStats } from "@/lib/catalogue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Compliance self-check", robots: { index: false, follow: false } };

export default async function CompliancePage() {
  const [report, stats] = await Promise.all([runCompliance(), catalogueStats()]);
  const db = await getDb();
  const runs = await db.query<{ network: string; started_at: string; rows_in: number; rows_ok: number; errors: number }>(
    "select network, started_at::text, rows_in, rows_ok, errors from feed_runs order by id desc limit 10",
  );

  return (
    <>
      <div className="eyebrow">Internal</div>
      <h1>Google CSS self-check</h1>
      <p className="lede">
        Overall: <span className={`status ${report.passed ? "pass" : "fail"}`}>{report.passed ? "passing" : "failing"}</span>{" "}
        · {stats.merchants} merchants · {stats.products} products · {stats.comparable} comparable · {stats.offers} live
        offers. Link checks run in the daily monitor only.
      </p>
      <table className="offers">
        <thead>
          <tr>
            <th>Requirement</th>
            <th>Status</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {report.checks.map((c) => (
            <tr key={c.id}>
              <td>{c.requirement}</td>
              <td>
                <span className={`status ${c.status}`}>{c.status}</span>
              </td>
              <td className="muted small">{c.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 style={{ marginTop: 32 }}>Recent feed runs</h2>
      <table className="offers">
        <thead>
          <tr>
            <th>Network</th>
            <th>Started</th>
            <th>Rows</th>
            <th>Loaded</th>
            <th>Errors</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r, i) => (
            <tr key={i}>
              <td>{r.network}</td>
              <td className="muted small">{r.started_at.slice(0, 16)}</td>
              <td className="num">{r.rows_in}</td>
              <td className="num">{r.rows_ok}</td>
              <td className="num">{r.errors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
