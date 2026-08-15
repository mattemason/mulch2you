import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand text-2xl text-brand-fg">
          ✓
        </div>
        <h1 className="mt-6 text-2xl font-semibold">Check your email</h1>
        <p className="mt-2 text-sm text-muted">
          We&apos;ve sent you a sign-in link. It works once and expires in 30
          minutes.
        </p>
        <Link href="/signin" className="btn-secondary mt-8 w-full">
          Use a different email
        </Link>
      </div>
    </main>
  );
}
