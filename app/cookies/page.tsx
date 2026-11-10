import type { Metadata } from "next";
import { site } from "@/lib/config";
import { Prose } from "@/components/Page";

export const metadata: Metadata = { title: "Cookies" };

export default function Cookies() {
  return (
    <Prose eyebrow="Legal" title="Cookies">
      <p>
        {site.name} does not set cookies. We do not use analytics, advertising or tracking cookies, so there is
        nothing to accept or decline.
      </p>
      <p>
        Shops and affiliate networks may set cookies once you follow a link and leave this site. Those cookies are
        covered by their own policies.
      </p>
    </Prose>
  );
}
