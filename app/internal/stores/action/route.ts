import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { setStoreStatus } from "@/lib/direct-stores";
import { site } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Approve or reject a shop. Behind the /internal basic auth; same-origin posts only. */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const self = new URL(req.url).origin;
  if (origin && origin !== self && origin !== new URL(site.url).origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const form = await req.formData();
  const id = Number(form.get("id"));
  const decision = form.get("decision");
  if (Number.isInteger(id) && (decision === "active" || decision === "rejected")) {
    await setStoreStatus(await getDb(), id, decision);
  }
  return NextResponse.redirect(new URL("/internal/stores", req.url), 303);
}
