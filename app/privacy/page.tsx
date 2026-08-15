import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/app/logo";
import { DEFAULT_FUZZ_METRES } from "@/lib/geo";

export const metadata: Metadata = { title: "Privacy — Mulch2You" };

/**
 * A factual description of what the software actually does with personal
 * information, not a drafted legal policy. Written this way deliberately: the
 * site collects home addresses today, so having no page at all is worse than
 * having an accurate one — but it needs a lawyer's eyes before launch, and
 * says so rather than pretending otherwise.
 */
export default function PrivacyPage() {
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
        <h1 className="text-3xl font-semibold">Privacy</h1>
        <p className="mt-3 text-muted">
          What we collect and who can see it. This describes how the site
          actually works today.
        </p>

        <div className="mt-8 space-y-8">
          <Section title="What we collect">
            <p>
              Your name and email address when you sign up. If you list a place
              for mulch, the address you give us and the coordinates it resolves
              to. If you register a tree service, your business name, mobile
              number and optionally an ABN. Photos you upload of a drop spot or
              a delivered load.
            </p>
          </Section>

          <Section title="Who can see your address">
            <p>
              Nobody, until you accept a drop. On the map, tree services see
              only your suburb and a pin deliberately offset by roughly{" "}
              {DEFAULT_FUZZ_METRES} metres from where you actually are — not
              your street address. That offset is generated once and stored, so
              it can&apos;t be averaged away by looking repeatedly.
            </p>
            <p>
              Only tree services we have approved by hand can see pins at all.
              When you accept a drop, your street address and phone number are
              released to that one business so they can find you and call ahead.
            </p>
          </Section>

          <Section title="Photos">
            <p>
              Every uploaded photo is re-encoded on our server, which removes
              the metadata cameras attach — including the GPS coordinates most
              phones record by default. Photos are never served from public
              links: a drop-spot photo is visible to you and to approved tree
              services, and a delivery photo only to you and the crew that made
              that delivery.
            </p>
          </Section>

          <Section title="Who else we send data to">
            <p>
              Address lookups are sent to our geocoding provider to turn what
              you type into a location. Email is delivered through Postmark. The
              site and database are hosted on Railway. We don&apos;t sell
              personal information, and we don&apos;t run advertising trackers.
            </p>
          </Section>

          <Section title="Deleting your data">
            <p>
              You can delete any listing from your dashboard, which also deletes
              its photo. To close your account and remove everything associated
              with it, email us and we&apos;ll action it.
            </p>
          </Section>

          <Section title="Still to come">
            <p>
              This page is a plain-English description written by the people who
              built the site, not a policy reviewed by a lawyer. A formal
              privacy policy meeting the Australian Privacy Principles will
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
