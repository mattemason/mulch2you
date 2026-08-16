import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/app/logo";

export const metadata: Metadata = { title: "Terms — Mulch2You" };

/**
 * As with the privacy page: a factual statement of how the arrangement works,
 * not drafted legal terms. The distinction that matters commercially is in
 * "What you're paying for" — the fee buys an introduction and a delivery, not
 * goods, which is what keeps consumer guarantees off the material itself.
 */
export default function TermsPage() {
  return (
    <main className="flex-1">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <Wordmark className="h-6" />
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            Home
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-3xl font-semibold">Terms</h1>
        <p className="mt-3 text-muted">How this works, in plain English.</p>

        <div className="mt-8 space-y-8">
          <Section title="What Mulch2You is">
            <p>
              An introduction service. We connect gardeners who want woodchip
              with tree services that have some to tip. We don&apos;t own,
              handle, inspect or sell the mulch, and we&apos;re not party to
              what happens on your property.
            </p>
          </Section>

          <Section title="What it costs">
            <p>
              Nothing, on either side. There&apos;s no fee, no subscription and
              no card on file. If that changes we&apos;ll say so plainly before
              it does, and nobody will be charged for anything they arranged
              under these terms.
            </p>
          </Section>

          <Section title="What you're getting">
            <p>
              Fresh arborist woodchip: a by-product of the day&apos;s work,
              unscreened, uncomposted, and whatever species the crew cut. You
              choose what to exclude when you list, but nobody is grading it,
              and it arrives as-is.
            </p>
          </Section>

          <Section title="Accepting a load">
            <p>
              You decide the maximum volume, where the truck tips, and which
              species you won&apos;t take. A driver may not be able to judge
              access from a photo — if your driveway, gate or overhead clearance
              can&apos;t take a truck, that&apos;s yours to assess before
              accepting. Damage to driveways, lawns, fences or anything else on
              your property is a matter between you and the tree service.
            </p>
          </Section>

          <Section title="Tree services">
            <p>
              Approved businesses are checked by hand before they can see pins,
              but approval is not an endorsement, a licence check, or a
              guarantee of insurance. Tree services are independent businesses,
              not our employees or contractors.
            </p>
          </Section>

          <Section title="Still to come">
            <p>
              This page is a plain-English summary written by the people who
              built the site, not terms reviewed by a lawyer. Proper terms will
              replace it before we open to the public.
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-2 space-y-3 text-muted">{children}</div>
    </section>
  );
}
