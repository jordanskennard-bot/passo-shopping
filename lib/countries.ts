/**
 * Countries Passo Shopping can serve. Google counts the CSS 50-merchant
 * minimum per country, so each country has its own section of the site,
 * its own offers and its own compliance check.
 *
 * COUNTRIES (comma separated, e.g. "GB,IE") turns countries on for feed
 * loading, the site and the monitor. The UK is always on and stays at the
 * root URL; other countries live under a prefix such as /ie.
 */
export interface Country {
  code: string;
  /** URL prefix, "" for the UK. */
  prefix: string;
  /** Short name used in copy: "UK shops", "Irish shops". */
  adjective: string;
  /** "the UK", "Ireland": used after "deliver to". */
  inName: string;
  currency: string;
  locale: string;
  /** html lang attribute. */
  lang: string;
  /** Awin feed list "Language" values accepted for this country (lower case prefixes). */
  feedLanguages: string[];
}

export const COUNTRIES: Record<string, Country> = {
  GB: {
    code: "GB",
    prefix: "",
    adjective: "UK",
    inName: "the UK",
    currency: "GBP",
    locale: "en-GB",
    lang: "en-GB",
    feedLanguages: ["english"],
  },
  IE: {
    code: "IE",
    prefix: "/ie",
    adjective: "Irish",
    inName: "Ireland",
    currency: "EUR",
    locale: "en-IE",
    lang: "en-IE",
    feedLanguages: ["english"],
  },
};

export const DEFAULT_COUNTRY = COUNTRIES.GB;

/** Countries switched on, UK first. Unknown codes are ignored. */
export function enabledCountries(raw = process.env.COUNTRIES): Country[] {
  const codes = (raw ?? "GB")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((c) => c && COUNTRIES[c]);
  const set = new Set(["GB", ...codes]);
  return [...set].map((c) => COUNTRIES[c]);
}

export function countryByCode(code: string | null | undefined): Country {
  return (code && COUNTRIES[code.toUpperCase()]) || DEFAULT_COUNTRY;
}

/** The enabled non-UK country whose prefix starts this path, if any. */
export function countryForPath(pathname: string, raw = process.env.COUNTRIES): Country | null {
  for (const c of enabledCountries(raw)) {
    if (c.prefix && (pathname === c.prefix || pathname.startsWith(`${c.prefix}/`))) return c;
  }
  return null;
}

/** Builds a link inside a country's section: path("/merchants") for Ireland is "/ie/merchants". */
export function localPath(c: Country, path: string): string {
  if (!c.prefix) return path;
  if (path === "/" || path === "") return c.prefix;
  return `${c.prefix}${path}`;
}
