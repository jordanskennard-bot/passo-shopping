import type { Metadata } from "next";
import Link from "next/link";
import { company, rules, site } from "@/lib/config";
import { Prose } from "@/components/Page";

export const metadata: Metadata = { title: "About us" };

export default function About() {
  return (
    <Prose eyebrow="About" title={`About ${site.name}`}>
      <p>
        {site.name} compares prices for the same product across UK shops, so you can see who sells it for the
        least once delivery is added. We do not sell anything: every offer links to the shop that sells it.
      </p>
      <p>
        {site.name} is a comparison shopping service in Google&apos;s Comparison Shopping Services programme. It is
        run by {company.legalName}, which also runs <a href={company.parentSite}>The Passo Agency</a>, a paid media
        service for online shops.
      </p>

      <h2>How it works</h2>
      <p>
        Shops send us their product feeds through the Awin affiliate network. We load every feed each night, so
        prices, delivery costs and stock are no more than a day old. An offer missing from a shop&apos;s feed for{" "}
        {rules.offerMaxAgeHours} hours is hidden.
      </p>
      <p>
        We match the same product across shops by its barcode (GTIN), or by brand and manufacturer part number when
        there is no barcode. We never merge products on a similar name, so a comparison is always like for like.
      </p>
      <p>
        Offers are ordered by total price, the item price plus UK delivery, with in-stock offers first. You can see
        every shop we compare on the <Link href="/merchants">Shops</Link> page.
      </p>

      <h2>What we do not do</h2>
      <p>
        We do not run voucher codes, cashback or loyalty schemes, and we do not bid on shops&apos; brand names in
        search ads. There are no accounts, no sign-up and no tracking cookies.
      </p>

      <h2>How we are paid</h2>
      <p>
        A shop may pay us a commission when you buy after following one of our links. You pay the same price, and
        commission never changes the order of offers. Shops cannot pay to rank higher. More on{" "}
        <Link href="/affiliate-disclosure">how we are paid</Link> and <Link href="/how-we-rank">how we rank</Link>.
      </p>

      <h2>Company details</h2>
      <p>
        {company.legalName}
        <br />
        Registered in {company.registeredIn}, company number {company.number}
        <br />
        Registered office: {company.address.join(", ")}
        <br />
        Email: <a href={`mailto:${company.contactEmail}`}>{company.contactEmail}</a>
      </p>
      <p>
        Shops and affiliate managers who want to be listed, or questions and corrections:{" "}
        <Link href="/contact">contact us</Link>.
      </p>
    </Prose>
  );
}
