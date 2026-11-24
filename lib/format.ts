import { DEFAULT_COUNTRY, type Country } from "./countries";

/** Formats minor units (pence, cents) in the country's currency. */
export function money(minor: number | null | undefined, c: Country = DEFAULT_COUNTRY): string {
  if (minor === null || minor === undefined) return "Not stated";
  return new Intl.NumberFormat(c.locale, { style: "currency", currency: c.currency }).format(minor / 100);
}

export function delivery(minor: number | null, c: Country = DEFAULT_COUNTRY): string {
  if (minor === null) return "Check with shop";
  if (minor === 0) return "Free";
  return money(minor, c);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
}
