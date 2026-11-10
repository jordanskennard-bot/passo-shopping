import { NextResponse } from "next/server";
import { authorised } from "@/lib/cron";
import { awinFeedUrls, ingestAwinFeed } from "@/lib/feeds/awin";
import { sendAlert } from "@/lib/alert";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const urls = awinFeedUrls();
  const results = [];
  for (const [i, url] of urls.entries()) {
    try {
      results.push({ feed: i + 1, ...(await ingestAwinFeed(url)) });
    } catch (err) {
      const message = (err as Error).message;
      results.push({ feed: i + 1, error: message });
      await sendAlert(`Feed ${i + 1} failed`, message);
    }
  }
  return NextResponse.json({ feeds: urls.length, results });
}
