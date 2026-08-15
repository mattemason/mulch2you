import { Resend } from "resend";
import { env, isProd } from "@/lib/env";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

type SendArgs = { to: string; subject: string; html: string; text: string };

export async function sendEmail({ to, subject, html, text }: SendArgs) {
  if (!resend) {
    // No key configured — don't fail the request, just make the content
    // obvious in the dev console so local flows stay testable.
    if (isProd) throw new Error("RESEND_API_KEY is not set; cannot send email");
    console.log(`\n📧 [dev email] to=${to}\n   subject: ${subject}\n   ${text}\n`);
    return;
  }

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });

  if (error) throw new Error(`Resend failed: ${error.message}`);
}

export async function sendMagicLinkEmail({ to, url }: { to: string; url: string }) {
  await sendEmail({
    to,
    subject: "Your Mulch2You sign-in link",
    text: `Sign in to Mulch2You: ${url}\n\nThis link expires in 30 minutes. If you didn't request it, ignore this email.`,
    html: layout(`
      <h1 style="margin:0 0 16px;font-size:22px;color:#14341f;">Sign in to Mulch2You</h1>
      <p style="margin:0 0 24px;color:#44544a;">Tap the button below. The link works once and expires in 30 minutes.</p>
      ${button(url, "Sign in")}
      <p style="margin:24px 0 0;font-size:13px;color:#7b8c82;">If you didn't request this, you can safely ignore it.</p>
    `),
  });
}

/* -------------------------------------------------------------------------- */

function button(url: string, label: string) {
  return `<a href="${url}" style="display:inline-block;background:#2f7a3f;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">${label}</a>`;
}

function layout(inner: string) {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f7f4;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
      ${inner}
      <hr style="border:none;border-top:1px solid #e6e9e4;margin:32px 0 16px;" />
      <p style="margin:0;font-size:12px;color:#9aa89f;">Mulch2You — free wood chip, straight from the truck.</p>
    </div>
  </body></html>`;
}
