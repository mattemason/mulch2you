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

export async function sendDropOfferEmail({
  to,
  gardenerName,
  businessName,
  suburb,
  eta,
  volume,
  respondUrl,
  expiresAt,
}: {
  to: string;
  gardenerName: string | null;
  businessName: string;
  suburb: string;
  eta: string;
  volume: string | null;
  respondUrl: string;
  expiresAt: Date;
}) {
  const greeting = gardenerName ? `G'day ${gardenerName.split(" ")[0]},` : "G'day,";
  const load = volume ? `${volume} of wood chip` : "a load of wood chip";
  const by = expiresAt.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });

  await sendEmail({
    to,
    subject: `${businessName} can drop mulch at your ${suburb} place`,
    text:
      `${greeting}\n\n${businessName} has ${load} and could get to your ${suburb} listing ${eta.toLowerCase()}.\n\n` +
      `Say yes or no here: ${respondUrl}\n\n` +
      `They'll only get your address if you say yes. If you don't answer by ${by}, the request lapses and they'll move on.`,
    html: layout(`
      <h1 style="margin:0 0 16px;font-size:22px;color:#1c1f1b;">A crew wants to drop mulch</h1>
      <p style="margin:0 0 8px;color:#44544a;">${greeting}</p>
      <p style="margin:0 0 20px;color:#44544a;">
        <strong>${businessName}</strong> has ${load} and could get to your
        ${suburb} listing <strong>${eta.toLowerCase()}</strong>.
      </p>
      ${button(respondUrl, "Say yes or no")}
      <p style="margin:24px 0 0;font-size:13px;color:#7b8c82;">
        They only get your address if you say yes. No answer by ${by} and the
        request lapses — the crew will have moved on.
      </p>
    `),
  });
}

export async function sendDropCancelledEmail({
  to,
  gardenerName,
  businessName,
  suburb,
  reason,
}: {
  to: string;
  gardenerName: string | null;
  businessName: string;
  suburb: string;
  reason: string | null;
}) {
  const greeting = gardenerName ? `G'day ${gardenerName.split(" ")[0]},` : "G'day,";
  await sendEmail({
    to,
    subject: `${businessName} can't make the drop after all`,
    text:
      `${greeting}\n\n${businessName} has released the claim on your ${suburb} listing, so no truck is coming.` +
      `${reason ? `\n\nThey said: ${reason}` : ""}\n\n` +
      `Your pin is back on the map and other crews can see it. Nothing has been charged.`,
    html: layout(`
      <h1 style="margin:0 0 16px;font-size:22px;color:#1c1f1b;">That drop isn't happening</h1>
      <p style="margin:0 0 8px;color:#44544a;">${greeting}</p>
      <p style="margin:0 0 16px;color:#44544a;">
        <strong>${businessName}</strong> has released the claim on your ${suburb}
        listing, so no truck is coming.
      </p>
      ${reason ? `<p style="margin:0 0 16px;padding:12px 14px;background:#f6f7f4;border-radius:8px;color:#44544a;">"${reason}"</p>` : ""}
      <p style="margin:0;color:#44544a;">
        Your pin is back on the map for other crews, and nothing has been charged.
      </p>
    `),
  });
}

export async function sendDeliveryReminderEmail({
  to,
  businessName,
  suburb,
  addressLine,
  claimedAt,
  dropUrl,
}: {
  to: string;
  businessName: string | null;
  suburb: string;
  addressLine: string;
  claimedAt: Date;
  dropUrl: string;
}) {
  const when = claimedAt.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
  await sendEmail({
    to,
    subject: `Did you drop that load at ${suburb}?`,
    text:
      `You claimed ${addressLine}, ${suburb} on ${when} and haven't closed it off.\n\n` +
      `If you've tipped it, add a photo to finish the job: ${dropUrl}\n\n` +
      `If you're not going, cancel the claim on the same page so someone else can take it.`,
    html: layout(`
      <h1 style="margin:0 0 16px;font-size:22px;color:#1c1f1b;">Still holding a drop</h1>
      <p style="margin:0 0 16px;color:#44544a;">
        ${businessName ? `${businessName} claimed` : "You claimed"} ${addressLine},
        ${suburb} on ${when} and it hasn't been closed off.
      </p>
      <p style="margin:0 0 24px;color:#44544a;">
        Tipped it already? Add a photo to finish the job. Not going? Cancel the
        claim on the same page so another crew can take it — the gardener is
        still waiting on a truck either way.
      </p>
      ${button(dropUrl, "Open the drop")}
    `),
  });
}

export async function sendOfferAcceptedEmail({
  to,
  businessName,
  addressLine,
  suburb,
  state,
  postcode,
  gardenerName,
  gardenerPhone,
  dropUrl,
}: {
  to: string;
  businessName: string | null;
  addressLine: string;
  suburb: string;
  state: string;
  postcode: string;
  gardenerName: string | null;
  gardenerPhone: string | null;
  dropUrl: string;
}) {
  const full = `${addressLine}, ${suburb} ${state} ${postcode}`;
  const who = gardenerName ?? "The gardener";
  const crew = businessName ? `${businessName} — ` : "";

  await sendEmail({
    to,
    subject: `${crew}yes from ${suburb}, you can drop that load`,
    text:
      `${who} said yes.\n\nDeliver to: ${full}\n` +
      `${gardenerPhone ? `Phone: ${gardenerPhone}\n` : ""}` +
      `\nOpen the drop for directions, and photograph the load once it's tipped to close the job: ${dropUrl}`,
    html: layout(`
      <h1 style="margin:0 0 16px;font-size:22px;color:#1c1f1b;">${who} said yes</h1>
      <p style="margin:0 0 6px;color:#7b8c82;font-size:13px;">Deliver to</p>
      <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1c1f1b;">${full}</p>
      ${gardenerPhone ? `<p style="margin:0 0 20px;color:#44544a;">Phone: <strong>${gardenerPhone}</strong></p>` : ""}
      <p style="margin:0 0 24px;color:#44544a;">
        Photograph the load once it's tipped to close the job off. If you can't
        make it after all, release the claim on the same page so another crew
        can take it.
      </p>
      ${button(dropUrl, "Open the drop")}
    `),
  });
}
