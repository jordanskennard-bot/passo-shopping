import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createSubmission, validateSubmission } from "@/lib/direct-stores";
import { countryByCode, localPath } from "@/lib/countries";
import { sendAlert } from "@/lib/alert";
import { site } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Receives the For shops form. Plain form post, then a redirect back with the outcome. */
export async function POST(req: Request) {
  const form = Object.fromEntries((await req.formData()).entries()) as Record<string, string>;
  const country = countryByCode(form.country);
  const back = (q: string) => NextResponse.redirect(new URL(`${localPath(country, "/for-shops")}?${q}#apply`, site.url), 303);

  const check = validateSubmission(form);
  if (!check.ok) {
    if (check.errors[0] === "spam") return back("sent=1");
    return back(`error=${encodeURIComponent(check.errors.join(" "))}`);
  }
  const db = await getDb();
  const outcome = await createSubmission(db, check.value);
  if (outcome === "busy") return back(`error=${encodeURIComponent("We are getting a lot of requests. Please email us instead.")}`);
  if (outcome === "created") {
    const v = check.value;
    await sendAlert(
      `New shop wants to be listed: ${v.name} (${v.country})`,
      `${v.name}\n${v.domain}\n${v.type === "shopify" ? "Shopify store" : "Google feed"}: ${v.url}\nCountry: ${v.country}\nContact: ${v.contactEmail}\n\nReview at ${site.url}/internal/stores`,
    ).catch(() => "logged");
  }
  return back("sent=1");
}
