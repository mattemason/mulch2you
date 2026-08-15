import "server-only";
import { ServerClient } from "postmark";
import { env, isProd } from "@/lib/env";

const client = env.POSTMARK_SERVER_TOKEN
  ? new ServerClient(env.POSTMARK_SERVER_TOKEN)
  : null;

type SendArgs = { to: string; subject: string; html: string; text: string };

export async function sendEmail({ to, subject, html, text }: SendArgs) {
  if (!client) {
    // No token configured — don't fail the request, just make the content
    // obvious in the dev console so local flows stay testable. In production
    // we throw instead: a magic link is a live credential and has no business
    // being written to a log.
    if (isProd) throw new Error("POSTMARK_SERVER_TOKEN is not set; cannot send email");
    console.log(`\n📧 [dev email] to=${to}\n   subject: ${subject}\n   ${text}\n`);
    return;
  }

  const res = await client.sendEmail({
    From: env.EMAIL_FROM,
    To: to,
    Subject: subject,
    HtmlBody: html,
    TextBody: text,
    MessageStream: env.POSTMARK_MESSAGE_STREAM,
  });

  // Postmark returns 200 with a non-zero ErrorCode for things like an
  // unconfirmed sender signature or a recipient on the suppression list.
  if (res.ErrorCode) {
    throw new Error(`Postmark ${res.ErrorCode}: ${res.Message}`);
  }
}

export async function sendMagicLinkEmail({ to, url }: { to: string; url: string }) {
  await sendEmail({
    to,
    subject: "Your Mulch2You sign-in link",
    text: `Sign in to Mulch2You: ${url}\n\nThis link expires in 30 minutes. If you didn't request it, ignore this email.`,
    html: layout(`
      <h1 style="margin:0 0 16px;font-size:22px;color:#1c1f1b;">Sign in to Mulch2You</h1>
      <p style="margin:0 0 24px;color:#44544a;">Tap the button below. The link works once and expires in 30 minutes.</p>
      ${button(url, "Sign in")}
      <p style="margin:24px 0 0;font-size:13px;color:#7b8c82;">If you didn't request this, you can safely ignore it.</p>
    `),
  });
}

export async function sendSupplierApprovedEmail({
  to,
  name,
  mapUrl,
}: {
  to: string;
  name: string | null;
  mapUrl: string;
}) {
  const greeting = name ? `G'day ${name.split(" ")[0]},` : "G'day,";
  await sendEmail({
    to,
    subject: "You're approved on Mulch2You",
    text: `${greeting}\n\nYou're approved. Open the map when you've got a full truck and you'll see who wants chip nearby: ${mapUrl}\n\nPins marked with a lightning bolt can be claimed on the spot — tap once and you get the address.`,
    html: layout(`
      <h1 style="margin:0 0 16px;font-size:22px;color:#1c1f1b;">You're approved</h1>
      <p style="margin:0 0 16px;color:#44544a;">${greeting} you're through — you can see the map now.</p>
      <p style="margin:0 0 24px;color:#44544a;">Open it when you've got a full truck. Pins marked ⚡ can be claimed on the spot: tap once and you get the street address, no waiting on a phone call.</p>
      ${button(mapUrl, "Find a drop nearby")}
    `),
  });
}

/* -------------------------------------------------------------------------- */

function button(url: string, label: string) {
  return `<a href="${url}" style="display:inline-block;background:#385020;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">${label}</a>`;
}

function layout(inner: string) {
  // Mail clients block remote images by default, so the logo is decoration
  // only — every email still reads correctly with images off, and the alt text
  // carries the brand. Needs an absolute URL; skipped entirely without one.
  const base = env.AUTH_URL?.replace(/\/$/, "");
  const header = base
    ? `<img src="${base}/wordmark.png" alt="Mulch2You" width="180" style="display:block;margin:0 0 24px;width:180px;max-width:100%;height:auto;" />`
    : `<p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#202020;">Mulch<span style="color:#385020;">2</span>You</p>`;

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f7f4;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
      ${header}
      ${inner}
      <hr style="border:none;border-top:1px solid #e6e9e4;margin:32px 0 16px;" />
      <p style="margin:0;font-size:12px;color:#9aa89f;">Mulch2You — we deliver, you benefit.</p>
    </div>
  </body></html>`;
}
