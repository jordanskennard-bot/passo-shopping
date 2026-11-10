# Decisions

Code and implementation decisions for passo-shopping. Product and business decisions live in the Passo plan (`plan/decisions.md`, D-101 and D-103 for this site).

1. **10 Nov 2026. Separate repo and database.** The comparison site is a public consumer site with a large catalogue and its own uptime needs, so it lives outside passo-prospects, with its own Postgres. No client data is stored here. (Jordan, 10 Nov 2026.)
2. **10 Nov 2026. Domain shopping.passoagency.com, display name "Passo Shopping".** Google requires the display name to reflect the business or domain. (Domain: Jordan, 10 Nov 2026.)
3. **10 Nov 2026. Next.js 15 on Vercel, Postgres via `pg`, PGlite for tests and the local demo only.** `getDb()` refuses PGlite when `NODE_ENV` is production, so demo data cannot reach the live site.
4. **10 Nov 2026. Search is Postgres full-text** (`websearch_to_tsquery`, brand weighted above title). Google forbids search substantially based on Google technology; this also avoids another hosted service. Revisit if the catalogue passes about a million offers.
5. **10 Nov 2026. Matching order:** the offer's existing product, then GTIN (check digit validated, padded to 14), then brand plus MPN among products without a GTIN, then a new single-merchant product. Title similarity never merges.
6. **10 Nov 2026. Offers unseen for 48 hours are hidden**, not deleted, so a feed outage does not wipe history.
7. **10 Nov 2026. Product page order is in-stock first, then lowest total (price plus delivery).** Commission never affects order, as stated on How we rank.
8. **10 Nov 2026. No cookies, no analytics.** Removes the need for a consent banner under PECR. Revisit only if analytics become necessary.
9. **10 Nov 2026. Compliance targets:** 60 merchants (Google's minimum is 50) and 50 products with two or more merchants. Both configurable by environment variable.
10. **10 Nov 2026. Ingestion is row by row.** Fine for tens of thousands of offers; batch it if a feed run nears the 300 second function limit.
11. **10 Nov 2026. Functions run in London (`lhr1`)** to sit next to a London database and UK shoppers.
12. **10 Nov 2026. Friendly error page** while the catalogue database is unavailable, so the site never shows a raw error to a shopper or Google reviewer.
13. **10 Nov 2026. Database connection comes from the Supabase Vercel integration** (`POSTGRES_URL`), or `DATABASE_URL` if set. `sslmode` is stripped from the URL so the code's ssl setting applies.
