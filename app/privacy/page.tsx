import type { Metadata } from "next";
import { company, site } from "@/lib/config";
import { Prose } from "@/components/Page";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <Prose eyebrow="Legal" title="Privacy notice">
      <p>
        {company.legalName} (company {company.number}, {company.address.join(", ")}) runs {site.name} and is the data
        controller for this site.
      </p>
      <h2>What we collect</h2>
      <p>
        You can use {site.name} without an account and without telling us who you are. Our hosting provider keeps
        standard server logs (IP address, browser, pages requested and time) for security and to keep the site
        running. We keep these for no longer than 30 days. Our lawful basis is our legitimate interest in running a
        secure website.
      </p>
      <p>We do not use analytics or advertising cookies on this site, and we do not sell personal data.</p>
      <h2>When you leave for a shop</h2>
      <p>
        When you follow a link to a shop, the shop and any affiliate network involved may set their own cookies to
        record that you came from us. Their privacy notices apply from that point.
      </p>
      <h2>If you email us</h2>
      <p>We use your email and message only to reply, and delete them within 12 months unless we need them longer to deal with your request.</p>
      <h2>Your rights</h2>
      <p>
        You can ask for a copy of personal data we hold about you, or ask us to correct or delete it, by emailing{" "}
        <a href={`mailto:${company.contactEmail}`}>{company.contactEmail}</a>. You can also complain to the
        Information Commissioner&apos;s Office at ico.org.uk.
      </p>
    </Prose>
  );
}
