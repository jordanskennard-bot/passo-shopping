import type { Metadata } from "next";
import { company, site } from "@/lib/config";
import { Prose } from "@/components/Page";

export const metadata: Metadata = { title: "How we are paid" };

export default function Disclosure() {
  return (
    <Prose eyebrow="Transparency" title="How we are paid">
      <p>
        Many links on {site.name} are affiliate links. If you follow one and buy something, the shop may pay{" "}
        {company.legalName} a commission through an affiliate network such as Awin. You pay the same price either way.
      </p>
      <p>
        Commission does not change which offers we show or their order, which is always by total price. Links that
        may earn us money are marked as sponsored in the page code.
      </p>
    </Prose>
  );
}
