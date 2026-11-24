import { NextResponse, type NextRequest } from "next/server";
import { countryForPath } from "./lib/countries";

const COUNTRY_HEADER = "x-passo-country";

/**
 * Two jobs:
 * 1. Country sections. /ie/... is served by the same pages as the UK root,
 *    with the country passed in a request header. The header is always set
 *    here, so a client cannot choose it.
 * 2. Basic auth for /internal. With no credentials configured, the area is closed.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/internal")) {
    const user = process.env.INTERNAL_USER;
    const pass = process.env.INTERNAL_PASSWORD;
    if (!user || !pass) return new NextResponse("Not found", { status: 404 });
    const header = req.headers.get("authorization") ?? "";
    const [scheme, encoded] = header.split(" ");
    const [u, p] = scheme === "Basic" && encoded ? atob(encoded).split(":") : [];
    if (u !== user || p !== pass) {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Passo Shopping internal"' },
      });
    }
  }

  const headers = new Headers(req.headers);
  const country = countryForPath(pathname);
  if (country) {
    headers.set(COUNTRY_HEADER, country.code);
    const url = req.nextUrl.clone();
    url.pathname = pathname.slice(country.prefix.length) || "/";
    return NextResponse.rewrite(url, { request: { headers } });
  }
  headers.set(COUNTRY_HEADER, "GB");
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"] };
