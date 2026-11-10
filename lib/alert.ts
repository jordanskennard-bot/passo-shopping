/**
 * Sends a compliance alert by email when SMTP is configured, otherwise logs it.
 * Env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_EMAIL, ALERT_FROM.
 */
export async function sendAlert(subject: string, body: string): Promise<"sent" | "logged"> {
  const host = process.env.SMTP_HOST;
  const to = process.env.ALERT_EMAIL;
  if (!host || !to) {
    console.warn(`[alert] ${subject}\n${body}`);
    return "logged";
  }
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: Number(process.env.SMTP_PORT ?? 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({
    from: process.env.ALERT_FROM ?? process.env.SMTP_USER,
    to,
    subject: `[Passo Shopping] ${subject}`,
    text: body,
  });
  return "sent";
}
