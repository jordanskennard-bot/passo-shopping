import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { company, site } from "@/lib/config";
import { SearchBox } from "@/components/SearchBox";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name}: compare prices from UK shops`, template: `%s · ${site.name}` },
  description: "Compare prices and delivery costs for the same product across UK shops.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <head>
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
            <Link href="/" className="brand">
              Passo <span>Shopping</span>
            </Link>
            <SearchBox />
            <nav aria-label="Main">
              <Link href="/merchants">Shops</Link>
              <Link href="/how-we-rank">How we rank</Link>
              <Link href="/about">About</Link>
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
              <Link href="/about">About</Link>
              <Link href="/contact">Contact</Link>
              <Link href="/how-we-rank">How we rank</Link>
              <Link href="/affiliate-disclosure">How we are paid</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/cookies">Cookies</Link>
              <Link href="/terms">Terms</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
