import { NextResponse } from "next/server";
import { authorised } from "@/lib/cron";
import { awinFeedUrls, ingestAwinFeed, listAwinFeeds, type AwinFormat } from "@/lib/feeds/awin";
import { ingestWebgainsFeed, webgainsFeeds } from "@/lib/feeds/webgains";
import { directFeeds, ingestDirectFeed } from "@/lib/feeds/direct";
import type { IngestResult } from "@/lib/ingest";
import { sendAlert } from "@/lib/alert";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Stop starting new feeds after this long, leaving room to finish the current one. */
const BUDGET_MS = 200_000;

interface Job {
  source: string;
  label: string;
  run: (deadline: number) => Promise<IngestResult>;
}

export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const started = Date.now();
  const jobs: Job[] = [];
  const results: Record<string, unknown>[] = [];

  try {
    for (const f of await listAwinFeeds()) {
      const format: AwinFormat = f.format;
      jobs.push({ source: `awin:${f.feedId}`, label: f.advertiserName, run: (d) => ingestAwinFeed(f.url, format, `awin:${f.feedId}`, d) });
    }
  } catch (err) {
    await sendAlert("Awin feed list failed", (err as Error).message);
    results.push({ feed: "feed list", error: (err as Error).message });
  }
  for (const [i, url] of awinFeedUrls().entries()) {
    const source = `awin-manual:${i + 1}`;
    jobs.push({ source, label: `Manual feed ${i + 1}`, run: (d) => ingestAwinFeed(url, "awin", source, d) });
  }
  try {
    for (const f of webgainsFeeds()) {
      const source = `webgains:${f.domain}`;
      jobs.push({ source, label: `${f.name} (Webgains)`, run: (d) => ingestWebgainsFeed(f, source, d) });
    }
    for (const f of directFeeds()) {
      const source = `direct:${f.domain ?? f.name}`;
      jobs.push({ source, label: `${f.name} (direct)`, run: (d) => ingestDirectFeed(f, source, d) });
    }
  } catch (err) {
    await sendAlert("Feed config unreadable", (err as Error).message);
    results.push({ feed: "feed config", error: (err as Error).message });
  }

  // Oldest first, so feeds that missed out last time go first tonight.
  const db = await getDb();
  const last = new Map(
    (
      await db.query<{ source: string; at: string }>(
        "select source, max(started_at)::text as at from feed_runs group by source",
      )
    ).map((r) => [r.source, r.at]),
  );
  jobs.sort((a, b) => (last.get(a.source) ?? "").localeCompare(last.get(b.source) ?? ""));

  let skipped = 0;
  for (const job of jobs) {
    if (Date.now() - started > BUDGET_MS) {
      skipped++;
      continue;
    }
    try {
      const r = await job.run(started + 280_000);
      results.push({ feed: job.label, rowsIn: r.rowsIn, rowsOk: r.rowsOk, errors: r.errors });
    } catch (err) {
      const message = (err as Error).message;
      results.push({ feed: job.label, error: message });
      await sendAlert(`Feed failed: ${job.label}`, message);
    }
  }
  if (skipped) await sendAlert("Feeds left for tomorrow", `${skipped} feeds did not fit in tonight's run.`);
  return NextResponse.json({ feeds: jobs.length, skipped, results });
}
