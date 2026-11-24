import { headers } from "next/headers";
import { countryByCode, type Country } from "./countries";

/** Header the middleware sets on every page request. Never trusted from the client: middleware overwrites it. */
export const COUNTRY_HEADER = "x-passo-country";

/** The country section the current request is in. */
export async function currentCountry(): Promise<Country> {
  const h = await headers();
  return countryByCode(h.get(COUNTRY_HEADER));
}
