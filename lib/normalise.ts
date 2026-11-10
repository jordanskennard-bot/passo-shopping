/** Returns a 14-digit GTIN if the input is a valid GTIN-8/12/13/14, else null. */
export function normaliseGtin(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  if (/^0+$/.test(digits)) return null;
  const padded = digits.padStart(14, "0");
  const body = padded.slice(0, 13);
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += Number(body[i]) * (i % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(padded[13]) ? padded : null;
}

/** Key used to match brand plus MPN across merchants. */
export function matchKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
  return key.length >= 2 ? key : null;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function domainFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** "Health & Beauty > Men's Grooming > Shavers" becomes "Shavers". */
export function leafCategory(path: string | null | undefined): string | null {
  if (!path) return null;
  const parts = path.split(/>|\/|\|/).map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

/** Parses "12.99", "£12.99" or "12,99" into pence. */
export function toPence(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/[£\s]/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function isHttpUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Appends the GS1 check digit to a 12-digit body, giving an EAN-13. */
export function ean13(body12: string): string {
  const d = body12.padStart(12, "0");
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * (i % 2 === 0 ? 1 : 3);
  return d + String((10 - (sum % 10)) % 10);
}
