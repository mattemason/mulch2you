import { z } from "zod";

/**
 * Fail fast on boot rather than at 2am when a lopper taps Claim and the SMS
 * silently doesn't send. Anything optional here is a Phase 2+ integration that
 * the app degrades gracefully without.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.string().url().optional(),

  // Email (magic links + drop notifications).
  // POSTMARK_SERVER_TOKEN is the per-server token, not the account token.
  POSTMARK_SERVER_TOKEN: z.string().optional(),
  POSTMARK_MESSAGE_STREAM: z.string().default("outbound"),
  // Must match a confirmed Postmark sender signature, or sending 400s.
  EMAIL_FROM: z.string().default("hello@example.com"),

  // Maps — MapTiler renders tiles, Google resolves AU addresses
  MAPTILER_KEY: z.string().optional(),
  GOOGLE_MAPS_KEY: z.string().optional(),

  // Phase 2
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(),

  CRON_SECRET: z.string().optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
  throw new Error(`Invalid environment configuration:\n${missing.join("\n")}`);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === "production";
