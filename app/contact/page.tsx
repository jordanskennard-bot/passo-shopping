import type { Metadata } from "next";
import { company, site } from "@/lib/config";
import { Prose } from "@/components/Page";

export const metadata: Metadata = { title: "Contact" };

export default function Contact() {
  return (
    <Prose eyebrow="Contact" title="Contact us">
      <p>
        For questions about {site.name}, a price that looks wrong, or a shop that wants to be listed or removed,
        email <a href={`mailto:${company.contactEmail}`}>{company.contactEmail}</a>. We reply within two working
        days.
      </p>
      {company.contactPhone && <p>Phone: {company.contactPhone}</p>}
      <p>
        Questions about an order, delivery or a refund are for the shop you bought from. We do not take orders or
        payments.
      </p>
      <h2>Postal address</h2>
      <p>
        {company.legalName}
        <br />
        {company.address.map((line) => (
          <span key={line}>
            {line}
            <br />
          </span>
        ))}
      </p>
    </Prose>
  );
}
