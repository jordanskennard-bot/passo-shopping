import type { Metadata } from "next";
import { company, site } from "@/lib/config";
import { Prose } from "@/components/Page";

export const metadata: Metadata = { title: "Terms of use" };

export default function Terms() {
  return (
    <Prose eyebrow="Legal" title="Terms of use">
      <p>
        {site.name} is run by {company.legalName}. By using the site you agree to these terms.
      </p>
      <h2>What the site does</h2>
      <p>
        We show prices, delivery costs and stock supplied by shops. We do not sell products, take payment or handle
        orders. Any purchase is between you and the shop, on the shop&apos;s terms.
      </p>
      <h2>Accuracy</h2>
      <p>
        We refresh shop data daily, but prices and stock can change between updates. Always check the price on the
        shop&apos;s own page before you buy. We are not responsible for errors in data a shop supplies.
      </p>
      <h2>Use of the site</h2>
      <p>
        You may use the site for personal shopping comparison. Do not copy the catalogue in bulk, run automated
        scraping, or try to disrupt the service.
      </p>
      <h2>Law</h2>
      <p>These terms are governed by the law of England and Wales.</p>
    </Prose>
  );
}
