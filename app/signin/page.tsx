import Link from "next/link";
import { signIn } from "@/auth";

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const role = typeof params.role === "string" ? params.role : undefined;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : "/dashboard";
  const error = typeof params.error === "string" ? params.error : undefined;

  async function sendLink(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    // Role is carried through the sign-in round trip so a first-time user lands
    // on the right half of onboarding instead of being asked twice.
    const target = role ? `/onboarding?role=${encodeURIComponent(role)}` : callbackUrl;
    await signIn("resend", { email, redirectTo: target });
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Mulch<span className="text-brand">2</span>You
        </Link>

        <h1 className="mt-8 text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted">
          Enter your email and we&apos;ll send a link. No password to remember.
        </p>

        {error && (
          <p className="mt-4 rounded-lg border border-border bg-card p-3 text-sm text-accent">
            That link didn&apos;t work — it may have expired. Try again below.
          </p>
        )}

        <form action={sendLink} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              className="field"
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            Email me a link
          </button>
        </form>
      </div>
    </main>
  );
}
