# Passo Shopping

The comparison shopping site behind the Passo CSS, at shopping.passoagency.com. It exists so Passo can run its own Comparison Shopping Service in Google's CSS programme (plan decision D-101). The site has to meet Google's requirements and keep meeting them; its traffic and income are not goals.

Run by Passo Agency Ltd (17208051). Kept separate from the Passo platform (passo-prospects) and from the client knowledge base.

## What it does

- Loads product feeds (Awin first) into Postgres, daily.
- Matches the same product across shops by GTIN, then brand plus MPN. Title similarity never merges products.
- Public site: search, category pages, product pages comparing every shop's price, delivery and total, shop list, company and legal pages.
- Daily compliance monitor against Google's CSS requirements, with email alerts.
- Internal self-check page at `/internal/compliance` (basic auth).

## Google's requirements and where they are met

Source: support.google.com/css-center/answer/7524491. The monitor (`lib/compliance.ts`) checks each row.

| Requirement | Where |
|---|---|
| 50+ merchant domains delivering to the UK | Feeds; monitor targets 60 |
| Compare the same product across merchants | GTIN matching; product page offer table |
| Products lead to a page where they can be bought | Offer links; monitor samples 20 a day |
| Own search, sortable by price plus another factor | Postgres full-text; brand, shop, free delivery filters |
| No default filter below three merchants | Merchant filter is opt-in |
| No sign-up | No accounts |
| Business address matches registration; contact details | `lib/config.ts`, footer, About, Contact |
| Not a marketplace | No checkout |

## Run it

```bash
npm install
npm run dev:demo     # in-memory Postgres with invented demo shops (.example domains); never used in production
npm test             # 13 tests on PGlite
npm run build
```

Against a real database:

```bash
cp .env.example .env.local   # fill in DATABASE_URL and the rest
npm run migrate
npm run dev
```

## Scheduled jobs (vercel.json)

- `/api/cron/ingest` 04:17 daily: downloads each `AWIN_FEED_URLS` feed and loads it.
- `/api/cron/monitor` 06:47 daily: runs the compliance checks with link sampling, saves the run, emails on any warning or failure.

Both need `Authorization: Bearer $CRON_SECRET`, which Vercel Cron sends.

## Before going live

1. Create a Supabase project for the catalogue and set `DATABASE_URL`; run `npm run migrate`.
2. Awin publisher account approved; join advertisers in 1 to 2 categories; create the feed in Create-a-Feed (CSV, gzip) and set `AWIN_FEED_URLS`. Verify the column names in `lib/feeds/awin.ts` against the first real feed.
3. DNS (done in Vercel 10 Nov 2026 except the record): at Namecheap, add a CNAME record, host `shopping`, value `27faafb01a94d8d0.vercel-dns-017.com.` (Vercel's fallback `cname.vercel-dns.com.` also works). Vercel project: `passo-shopping`, functions in London (`lhr1`). Put the catalogue database in London too (Supabase region eu-west-2).
4. Set `CRON_SECRET`, `INTERNAL_USER`, `INTERNAL_PASSWORD` and the SMTP variables.
5. Legal pages are drafts: review them in the lawyer hour (plan Q-009).
6. When the self-check passes with 60+ merchants: Google CSS sign-up (Phase 3 of `claude/passo-css-build-brief.md` in the Passo Project).

## Decisions

Code decisions are in `DECISIONS.md`.
