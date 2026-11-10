import { NextResponse } from "next/server";
import { authorised } from "@/lib/cron";
import { runCompliance, summarise } from "@/lib/compliance";
import { sendAlert } from "@/lib/alert";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const report = await runCompliance({ linkCheck: true, save: true });
  const problems = report.checks.filter((c) => c.status !== "pass");
  if (problems.length) {
    await sendAlert(
      report.passed ? "Compliance warning" : "Compliance FAILING: Google CSS requirements at risk",
      summarise(report),
    );
  }
  return NextResponse.json(report);
}
