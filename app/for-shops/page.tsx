import { currentCountry } from "@/lib/request-country";
import { enabledCountries, localPath } from "@/lib/countries";
import type { Metadata } from "next";
import Link from "next/link";
import { company, site } from "@/lib/config";
import { catalogueStats } from "@/lib/catalogue";
import { plural } from "@/lib/format";
import { Prose } from "@/components/Page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "For shops" };

type Props = { searchParams: Promise<{ sent?: string; error?: string }> };

export default async function ForShops({ searchParams }: Props) {
  const c = await currentCountry();
  const { sent, error } = await searchParams;
  const countries = enabledCountries();
  const stats = await catalogueStats(c.code);
  return (
    <Prose eyebrow="For shops" title={`List your products on ${site.name}`}>
      <p>
        {site.name} compares the same product across {c.adjective} shops, ranked by total price including delivery. We list{" "}
        {stats.products.toLocaleString("en-GB")} products from {plural(stats.merchants, "shop")} today. Listing is free,
        and no shop can pay to rank higher.
      </p>

      <h2>Three ways to be listed</h2>
      <p>
        <strong>Through Awin.</strong> If your affiliate programme runs on Awin, approve publisher {company.legalName}{" "}
        (ID 3151486). Your product feed is picked up automatically the night after approval.
      </p>
      <p>
        <strong>Through another affiliate network.</strong> Tell us which network you use and we will apply to your
        programme there.
      </p>
      <p>
        <strong>Directly.</strong> Use the form below with the Google Shopping feed you already use for Google
        Merchant Center (XML or CSV), or just your Shopify store address. Links go straight to your shop with no
        tracking and no fee.
      </p>

      <h2>What we need</h2>
      <p>
        You deliver to {c.inName}, and your feed has a price, a product page link and stock status for each product. A
        barcode (GTIN) or brand plus manufacturer part number lets us match your products to other shops&apos;. Stating
        delivery cost lets us show your true total price.
      </p>

      <h2>What we do not do</h2>
      <p>
        No voucher codes, no cashback, no incentives and no bidding on your brand name. Your products appear with your
        own name and prices, refreshed daily from your feed.
      </p>


      <h2 id="apply">List your shop directly</h2>
      {sent && <p className="notice">Thanks. We check every request by hand and will email you within two working days.</p>}
      {error && <p className="notice error">{error}</p>}
      {!sent && (
        <form className="apply" method="post" action="/api/direct-stores">
          <label>
            Shop name
            <input name="name" required maxLength={120} />
          </label>
          <label>
            Website
            <input name="website" required placeholder="www.yourshop.co.uk" />
          </label>
          <fieldset>
            <legend>Your product data</legend>
            <label className="inline">
              <input type="radio" name="type" value="shopify" defaultChecked /> My shop runs on Shopify (we read your
              public product list)
            </label>
            <label className="inline">
              <input type="radio" name="type" value="google" /> I have a Google Shopping feed (XML or CSV)
            </label>
          </fieldset>
          <label>
            Feed address (Google feed only)
            <input name="feed_url" placeholder="https://" />
          </label>
          <label>
            Country your prices are for
            <select name="country" defaultValue={c.code}>
              {countries.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.code === "GB" ? "United Kingdom" : x.inName} ({x.currency})
                </option>
              ))}
            </select>
          </label>
          <label>
            Standard delivery cost, if it is the same for every order (optional)
            <input name="delivery" inputMode="decimal" placeholder="3.95" />
          </label>
          <label>
            Contact email
            <input name="email" type="email" required />
          </label>
          <label className="hp" aria-hidden="true">
            Leave this empty
            <input name="website_confirm" tabIndex={-1} autoComplete="off" />
          </label>
          <label className="inline">
            <input type="checkbox" name="consent" value="yes" required /> I run this shop, it delivers to the country
            above, and {company.legalName} may list its products on {site.name} and link to and read its product pages.
          </label>
          <button type="submit">Send request</button>
        </form>
      )}

      <p>
        To ask a question, email <a href={`mailto:${company.contactEmail}`}>{company.contactEmail}</a> or
        use the <Link href={localPath(c, "/contact")}>contact page</Link>.
      </p>
    </Prose>
  );
}
