import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";
import { env, isProd } from "@/lib/env";
import { sendMagicLinkEmail } from "@/lib/email";

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
  providers: [
    Resend({
      apiKey: env.RESEND_API_KEY ?? "dev-no-key",
      from: env.EMAIL_FROM,
      // 24h is too long for a credential in an inbox; 30 min is still forgiving
      // of someone who taps the link after finishing a job.
      maxAge: 60 * 30,
      sendVerificationRequest: async ({ identifier, url }) => {
        await sendMagicLinkEmail({ to: identifier, url });
      },
    }),
  ],
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
