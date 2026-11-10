import type { Metadata } from "next";
import Link from "next/link";
import { company, site } from "@/lib/config";
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
      <h2>Company details</h2>
      <p>
        {company.legalName}
        <br />
        Registered in {company.registeredIn}, company number {company.number}
        <br />
        Registered office: {company.address.join(", ")}
      </p>
      <p>
        Questions or corrections: <Link href="/contact">contact us</Link>.
      </p>
    </Prose>
  );
}
