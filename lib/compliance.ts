import { getDb, type Db } from "./db";
import { company, rules, site } from "./config";
import { catalogueStats, searchProducts } from "./catalogue";

export type Status = "pass" | "warn" | "fail";

export interface Check {
  id: string;
  requirement: string;
  status: Status;
  detail: string;
}

export interface ComplianceReport {
  runAt: string;
  passed: boolean;
  merchantCount: number;
  checks: Check[];
}

/**
 * Checks the site against Google's CSS programme requirements
 * (support.google.com/css-center/answer/7524491). Rows that are met by design
 * are listed too, so the report mirrors the requirement list in full.
 */
export async function runCompliance(
  opts: { linkCheck?: boolean; save?: boolean; db?: Db } = {},
): Promise<ComplianceReport> {
  const db = opts.db ?? (await getDb());
  const stats = await catalogueStats(db);
  const checks: Check[] = [];

  checks.push({
    id: "merchants",
    requirement: `Products from at least ${rules.merchantsRequired} distinct merchant domains delivering to the UK`,
    status:
      stats.merchants >= rules.merchantsTarget ? "pass" : stats.merchants >= rules.merchantsRequired ? "warn" : "fail",
    detail: `${stats.merchants} merchants with live UK offers (target ${rules.merchantsTarget} for headroom).`,
  });

  checks.push({
    id: "compare",
    requirement: "Users can compare price and selling conditions for the same product from different merchants",
    status: stats.comparable >= rules.comparableProductsTarget ? "pass" : stats.comparable > 0 ? "warn" : "fail",
    detail: `${stats.comparable} of ${stats.products} products show two or more merchants (target ${rules.comparableProductsTarget}).`,
  });

  const [fresh] = await db.query<{ total: number; fresh: number }>(
    `select count(*)::int as total,
            count(*) filter (where last_seen > now() - interval '26 hours')::int as fresh
     from offers where country = $1 and last_seen > now() - make_interval(hours => ${rules.offerMaxAgeHours})`,
    [site.country],
  );
  const freshShare = fresh.total ? fresh.fresh / fresh.total : 0;
  checks.push({
    id: "fresh",
    requirement: "Prices and stock are current",
    status: freshShare >= 0.9 ? "pass" : freshShare >= 0.6 ? "warn" : "fail",
    detail: `${Math.round(freshShare * 100)}% of live offers were refreshed in the last 26 hours.`,
  });

  // Search works: take a word from a real product title and confirm it finds results.
  const [sample] = await db.query<{ title: string }>(
    `select p.title from products p join offers o on o.product_id = p.id
     where o.last_seen > now() - interval '48 hours' order by p.id limit 1`,
  );
  let searchStatus: Status = "fail";
  let searchDetail = "No live products to search yet.";
  if (sample) {
    const term = sample.title.split(/\s+/).find((w) => w.length > 3) ?? sample.title;
    const res = await searchProducts({ q: term }, db);
    searchStatus = res.total > 0 ? "pass" : "fail";
    searchDetail = `Searching "${term}" returned ${res.total} products, sortable by price, filterable by brand, merchant and free delivery.`;
  }
  checks.push({
    id: "search",
    requirement: "Own search box driven by an automated process; results sortable by price and filterable by another factor",
    status: searchStatus,
    detail: searchDetail,
  });

  if (opts.linkCheck) {
    const sampleOffers = await db.query<{ url: string }>(
      `select url from offers where last_seen > now() - interval '48 hours' order by random() limit 20`,
    );
    let ok = 0;
    for (const o of sampleOffers) {
      if (await linkWorks(o.url)) ok++;
    }
    const share = sampleOffers.length ? ok / sampleOffers.length : 0;
    checks.push({
      id: "links",
      requirement: "Products lead to a page where they can be bought",
      status: sampleOffers.length === 0 ? "fail" : share >= 0.9 ? "pass" : share >= 0.7 ? "warn" : "fail",
      detail: `${ok} of ${sampleOffers.length} sampled merchant pages loaded.`,
    });
  }

  const detailsOk = Boolean(company.legalName && company.number && company.address.length && company.contactEmail);
  checks.push({
    id: "business",
    requirement: "Business registered in a supported country, with matching address and contact details on the site",
    status: detailsOk ? "pass" : "fail",
    detail: `${company.legalName}, company ${company.number}, ${company.address.join(", ")}. Contact ${company.contactEmail}.`,
  });

  for (const [id, requirement, detail] of [
    ["filters", "No prominent filter restricts results to fewer than three merchants by default", "By design: the merchant filter is opt-in and nothing narrows results by merchant on arrival."],
    ["access", "Site accessible without sign-up", "By design: the site has no accounts."],
    ["marketplace", "Not primarily a marketplace", "By design: no checkout; every offer links to the merchant."],
    ["google-search", "Search not substantially based on Google search technology", "By design: Postgres full-text search."],
  ] as const) {
    checks.push({ id, requirement, status: "pass", detail });
  }

  const report: ComplianceReport = {
    runAt: new Date().toISOString(),
    passed: checks.every((c) => c.status !== "fail"),
    merchantCount: stats.merchants,
    checks,
  };

  if (opts.save) {
    await db.query("insert into compliance_runs (passed, merchant_count, checks) values ($1, $2, $3)", [
      report.passed,
      report.merchantCount,
      JSON.stringify(report.checks),
    ]);
  }
  return report;
}

async function linkWorks(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    let res = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctrl.signal });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, { method: "GET", redirect: "follow", signal: ctrl.signal });
    }
    clearTimeout(t);
    return res.status < 400;
  } catch {
    return false;
  }
}

export function summarise(report: ComplianceReport): string {
  return report.checks
    .map((c) => `${c.status.toUpperCase().padEnd(4)}  ${c.requirement}\n      ${c.detail}`)
    .join("\n");
}
