import NextAuth from "next-auth";
import type { EmailConfig } from "next-auth/providers";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";
import { env, isProd } from "@/lib/env";
import { sendMagicLinkEmail } from "@/lib/email";

/**
 * Our own email provider rather than a bundled one, so the transport (Postmark)
 * and the template live in lib/email.ts and swapping either doesn't touch auth.
 * Auth.js only needs the shape: an "email" provider whose sendVerificationRequest
 * delivers the URL. Token generation and storage stay with the adapter.
 */
const emailProvider: EmailConfig = {
  id: "email",
  type: "email",
  name: "Email",
  from: env.EMAIL_FROM,
  // 24h is too long for a live credential sitting in an inbox; 30 min is still
  // forgiving of someone who taps the link after finishing a job.
  maxAge: 60 * 30,
  options: {},
  async sendVerificationRequest({ identifier, url }) {
    await sendMagicLinkEmail({ to: identifier, url });
  },
};

/**
 * Magic links only. The supply side of this marketplace is tradies tapping on
 * a phone in someone's front yard — a password field is a funnel with a hole
 * in it. Sessions are JWT so middleware can run on the edge without a DB round
 * trip; role is deliberately NOT in the token (see lib/session.ts).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 90 },
  trustHost: true,
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin/check-email",
    error: "/signin",
  },
  providers: [emailProvider],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  debug: !isProd,
});
