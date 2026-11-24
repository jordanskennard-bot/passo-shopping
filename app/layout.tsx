import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { company, rules, site } from "@/lib/config";
import { enabledCountries, localPath } from "@/lib/countries";
import { currentCountry } from "@/lib/request-country";
import { catalogueStats } from "@/lib/catalogue";
import { SearchBox } from "@/components/SearchBox";

export async function generateMetadata(): Promise<Metadata> {
  const c = await currentCountry();
  // A country section stays out of search engines until it meets Google's merchant minimum.
  let hidden = false;
  if (c.prefix) {
    try {
      hidden = (await catalogueStats(c.code)).merchants < rules.merchantsRequired;
    } catch {
      hidden = true;
    }
  }
  return {
    metadataBase: new URL(site.url),
    title: { default: `${site.name}: compare prices from ${c.adjective} shops`, template: `%s · ${site.name}` },
    description: `Compare prices and delivery costs for the same product across ${c.adjective} shops.`,
    ...(hidden ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const c = await currentCountry();
  const countries = enabledCountries();
  return (
    <html lang={c.lang}>
      <head>
        {/* impact.com site ownership check. impact asks for value=, so content= is added too. */}
        <meta
          name="impact-site-verification"
          content="fa87e8ce-145b-4ec1-bbb6-74042cc848e1"
          {...{ value: "fa87e8ce-145b-4ec1-bbb6-74042cc848e1" }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Inter:wght@400;500&display=swap"
        />
      </head>
      <body>
        <header className="site-header">
          <div className="wrap">
            <Link href={localPath(c, "/")} className="brand">
              Passo <span>Shopping</span>
              {c.prefix && <span className="muted small"> {c.inName}</span>}
            </Link>
            <SearchBox action={localPath(c, "/search")} />
            <nav aria-label="Main">
              <Link href={localPath(c, "/merchants")}>Shops</Link>
              <Link href={localPath(c, "/how-we-rank")}>How we rank</Link>
              <Link href={localPath(c, "/about")}>About</Link>
            </nav>
          </div>
        </header>
        <main>
          <div className="wrap">{children}</div>
        </main>
        <footer className="site-footer">
          <div className="wrap">
            <div>
              {site.name} is run by {company.legalName}, a company registered in {company.registeredIn} (number{" "}
              {company.number}). Registered office: {company.address.join(", ")}.
            </div>
            <nav aria-label="Footer">
              <Link href={localPath(c, "/about")}>About</Link>
              <Link href={localPath(c, "/for-shops")}>For shops</Link>
              <Link href={localPath(c, "/contact")}>Contact</Link>
              <Link href={localPath(c, "/how-we-rank")}>How we rank</Link>
              <Link href={localPath(c, "/affiliate-disclosure")}>How we are paid</Link>
              <Link href={localPath(c, "/privacy")}>Privacy</Link>
              <Link href={localPath(c, "/cookies")}>Cookies</Link>
              <Link href={localPath(c, "/terms")}>Terms</Link>
            </nav>
            {countries.length > 1 && (
              <nav aria-label="Country">
                {countries.map((x) => (
                  <Link key={x.code} href={localPath(x, "/")} className={x.code === c.code ? "on" : ""} hrefLang={x.lang}>
                    {x.code === "GB" ? "United Kingdom" : x.inName}
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </footer>
      </body>
    </html>
  );
}
