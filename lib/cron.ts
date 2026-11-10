/** Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". */
export function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
}
