import fs from "node:fs";
import path from "node:path";
import type { Db } from "./db";
import { COUNTRIES, enabledCountries } from "./countries";
import { domainFromUrl, isHttpUrl } from "./normalise";
import type { DirectFeed } from "./feeds/direct";

/**
 * Shops that ask to be listed directly from the For shops page. A
 * submission is held as pending until Jordan approves it on
 * /internal/stores; active stores are loaded in the nightly run like
 * DIRECT_FEEDS entries. Consent (owner, delivers to the country, may be
 * listed and linked) is recorded with a timestamp, because Google requires
 * the CSS to have the rights to crawl merchants' pages.
 */
export interface StoreSubmission {
  name: string;
  domain: string;
  type: "google" | "shopify";
  url: string;
  country: string;
  deliveryPence: number | null;
  contactEmail: string;
}

export interface StoreRow extends StoreSubmission {
  id: number;
  status: "pending" | "active" | "rejected";
  createdAt: string;
}

let ensured = false;
/** Creates the table on first use, so the live database needs no manual migration. */
export async function ensureStoresTable(db: Db): Promise<void> {
  if (ensured) return;
  const sql = fs.readFileSync(path.join(process.cwd(), "db", "migrations", "002_direct_stores.sql"), "utf8");
  await db.query(sql);
  ensured = true;
}

/** Test hook: forget that the table was created (each test gets a fresh database). */
export function resetEnsured() {
  ensured = false;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSubmission(
  form: Record<string, string | undefined>,
  countries = enabledCountries().map((c) => c.code),
): { ok: true; value: StoreSubmission } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const get = (k: string) => (form[k] ?? "").trim();
  if (get("website_confirm")) return { ok: false, errors: ["spam"] }; // honeypot, hidden from people

  const name = get("name").slice(0, 120);
  if (!name) errors.push("Shop name is missing.");

  let site = get("website");
  if (site && !/^[a-z][a-z0-9+.-]*:/i.test(site)) site = `https://${site}`;
  const domain = isHttpUrl(site) ? domainFromUrl(site) : null;
  if (!domain) errors.push("Website address is not valid.");

  const type = get("type") === "shopify" ? "shopify" : "google";
  let url = get("feed_url");
  if (type === "shopify") url = url || site;
  if (url && !/^[a-z][a-z0-9+.-]*:/i.test(url)) url = `https://${url}`;
  if (!isHttpUrl(url) || !url.startsWith("https://")) errors.push("Feed address must be a full https:// address.");

  const country = get("country").toUpperCase() || "GB";
  if (!countries.includes(country) || !COUNTRIES[country]) errors.push("Choose a country we cover.");

  const deliveryRaw = get("delivery");
  let deliveryPence: number | null = null;
  if (deliveryRaw) {
    const n = Number(deliveryRaw.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n) || n < 0 || n > 1000) errors.push("Delivery cost is not a number.");
    else deliveryPence = Math.round(n * 100);
  }

  const contactEmail = get("email").toLowerCase();
  if (!EMAIL.test(contactEmail)) errors.push("Contact email is not valid.");
  if (get("consent") !== "yes") errors.push("Please confirm the statement at the end of the form.");

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { name, domain: domain!, type, url, country, deliveryPence, contactEmail } };
}

export async function createSubmission(db: Db, s: StoreSubmission): Promise<"created" | "exists" | "busy"> {
  await ensureStoresTable(db);
  const [recent] = await db.query<{ n: number }>(
    "select count(*)::int as n from direct_stores where created_at > now() - interval '1 day'",
  );
  if (recent.n >= 50) return "busy";
  const rows = await db.query<{ id: number }>(
    `insert into direct_stores (name, domain, type, url, country, delivery_pence, contact_email, consent_at)
     values ($1, $2, $3, $4, $5, $6, $7, now())
     on conflict (domain, country) do nothing returning id`,
    [s.name, s.domain, s.type, s.url, s.country, s.deliveryPence, s.contactEmail],
  );
  return rows.length ? "created" : "exists";
}

export async function listStores(db: Db): Promise<StoreRow[]> {
  await ensureStoresTable(db);
  return db.query<StoreRow>(
    `select id, name, domain, type, url, country, delivery_pence as "deliveryPence", contact_email as "contactEmail",
            status, created_at::text as "createdAt"
     from direct_stores order by (status = 'pending') desc, created_at desc limit 200`,
  );
}

export async function setStoreStatus(db: Db, id: number, status: "active" | "rejected"): Promise<void> {
  await ensureStoresTable(db);
  await db.query("update direct_stores set status = $2, decided_at = now() where id = $1", [id, status]);
}

/** Approved stores in enabled countries, in the shape the nightly ingest takes. */
export async function activeStoreFeeds(db: Db): Promise<DirectFeed[]> {
  await ensureStoresTable(db);
  const codes = enabledCountries().map((c) => c.code);
  const rows = await db.query<{ name: string; domain: string; type: string; url: string; country: string; delivery_pence: number | null }>(
    "select name, domain, type, url, country, delivery_pence from direct_stores where status = 'active' order by id",
  );
  return rows
    .filter((r) => codes.includes(r.country))
    .map((r) => ({
      name: r.name,
      domain: r.domain,
      url: r.url,
      type: r.type === "shopify" ? "shopify" : "google",
      deliveryPence: r.delivery_pence,
      country: r.country,
    }));
}
