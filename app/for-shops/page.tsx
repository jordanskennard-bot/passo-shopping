import { currentCountry } from "@/lib/request-country";
import { localPath } from "@/lib/countries";
import type { Metadata } from "next";
import Link from "next/link";
import { company, site } from "@/lib/config";
import { catalogueStats } from "@/lib/catalogue";
import { plural } from "@/lib/format";
import { Prose } from "@/components/Page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "For shops" };

export default async function ForShops() {
  const c = await currentCountry();
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
        <strong>Directly.</strong> Send us the address of the Google Shopping feed you already use for Google Merchant
        Center, in XML or CSV. Links go straight to your shop with no tracking and no fee.
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

      <p>
        To get listed or ask a question, email <a href={`mailto:${company.contactEmail}`}>{company.contactEmail}</a> or
        use the <Link href={localPath(c, "/contact")}>contact page</Link>.
      </p>
    </Prose>
  );
}
