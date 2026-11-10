import type { Metadata } from "next";
import { rules, site } from "@/lib/config";
import { Prose } from "@/components/Page";

export const metadata: Metadata = { title: "How we rank" };

export default function HowWeRank() {
  return (
    <Prose eyebrow="Transparency" title="How we rank results">
      <h2>Search results</h2>
      <p>
        When you search, products are ordered by how well their name and brand match your words, then by how many
        shops sell them, then by lowest total price. You can sort by price instead, and filter by brand, shop or free
        delivery. No filter is applied until you choose one.
      </p>
      <h2>Offers on a product page</h2>
      <p>
        Offers are ordered by total price: the item price plus standard delivery to the UK. Shops with the product in
        stock come first. Where a shop does not state delivery, we show the item price and say so.
      </p>
      <h2>What we include</h2>
      <p>
        We list shops that deliver to the UK and supply a product feed. Prices and stock are refreshed daily. An
        offer that has not appeared in a shop&apos;s feed for {rules.offerMaxAgeHours} hours is hidden.
      </p>
      <h2>Payment</h2>
      <p>
        {site.name} may be paid a commission when you visit or buy from a shop through our links. Commission never
        affects the order of offers or results. Shops cannot pay to rank higher.
      </p>
    </Prose>
  );
}
