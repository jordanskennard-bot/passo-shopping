import { NextResponse } from "next/server";
import { authorised } from "@/lib/cron";
import { runCompliance, summarise } from "@/lib/compliance";
import { sendAlert } from "@/lib/alert";
import { enabledCountries } from "@/lib/countries";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Google counts the CSS requirements per country, so each enabled country gets its own run and alert. */
export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const reports = [];
  for (const country of enabledCountries()) {
    const report = await runCompliance({ linkCheck: true, save: true, country });
    reports.push(report);
    const problems = report.checks.filter((c) => c.status !== "pass");
    if (problems.length) {
      await sendAlert(
        report.passed
          ? `Compliance warning (${country.code})`
          : `Compliance FAILING (${country.code}): Google CSS requirements at risk`,
        summarise(report),
      );
    }
  }
  return NextResponse.json(reports.length === 1 ? reports[0] : reports);
}
