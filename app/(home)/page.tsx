import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getCurrentUser, receiverHref, supplierHref } from "@/lib/session";
import { SiteHeader } from "./site-header";
import { HowItWorks } from "./how-it-works";
import { MapPreview } from "./map-preview";
import { Faq } from "./faq";
import "./marketing.css";

export const metadata: Metadata = {
  title: "Mulch2You — free mulch delivered, straight from the truck",
  description:
    "A free truckload of arborist woodchip on your driveway. Tree crews tip locally instead of queuing at the transfer station, and nobody pays a cent.",
};

export default async function HomePage() {
  const user = await getCurrentUser();
  const signedIn = Boolean(user);
  // Resolved once: a signed-in visitor should never be shown a sign-in form by
  // a button that says "put my pin on the map".
  const receiverTo = receiverHref(user);
  const supplierTo = supplierHref(user);

  return (
    <div className="marketing">
      <div className="topbar">
        <div className="wrap">
          <div>
            🌿 Getting started on the <strong>Sunshine Coast</strong>
          </div>
          <nav className="topbar-links">
            <a href="#faq">Help</a>
            <Link href={signedIn ? "/dashboard" : "/signin"}>
              {signedIn ? "Dashboard" : "Log in"}
            </Link>
          </nav>
        </div>
      </div>

      <SiteHeader signedIn={signedIn} receiverHref={receiverTo} supplierHref={supplierTo} />

      {/* ---------------- hero ---------------- */}
      <section className="hero">
        <div className="wrap">
          <div className="hero-top">
            <span className="eyebrow">Free for gardeners · free for tree crews</span>
            <h1 className="display">
              The truck is already loaded.
              <br />
              Get it tipped <span className="green">at yours.</span>
            </h1>
            <p className="lead">
              Tree crews pay to dump woodchip. Gardeners pay a fortune to buy it back
              in bags. Mulch2You puts them on the same map, so the load goes in your
              garden instead of a transfer station — free, both ways.
            </p>
          </div>

          <div className="doors">
            <div className="door door--home">
              <div className="door-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 10.5 12 3l9 7.5" />
                  <path d="M5 9.5V21h14V9.5" />
                  <path d="M9.5 21v-6h5v6" />
                </svg>
              </div>
              <div className="door-kicker">For homeowners &amp; gardeners</div>
              <h2>I want mulch delivered</h2>
              <p>
                Drop a pin, pick a load size, and pay one flat fee — only once the mulch is
                actually on the ground.
              </p>
              <ul>
                <Bullet>
                  <strong>Free</strong> — the load and the delivery
                </Bullet>
                <Bullet>Pick your size — ute load through to a full truck</Bullet>
                <Bullet>No card, no invoice, nothing to pay</Bullet>
                <Bullet>Set species you won&apos;t take, and where the truck tips</Bullet>
              </ul>
              <Link href={receiverTo} className="btn btn-green btn-lg btn-block">
                Put my pin on the map <Arrow />
              </Link>
              <div className="door-foot">Listing is free and takes about 90 seconds.</div>
            </div>

            <div className="door door--arb" id="arborists">
              <div className="door-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M2 16h11V8h4l4 4v4h-2" />
                  <circle cx="7" cy="18" r="2" />
                  <circle cx="17" cy="18" r="2" />
                  <path d="M13 16h2" />
                </svg>
              </div>
              <div className="door-kicker">For arborists &amp; tree crews</div>
              <h2>I&apos;ve got mulch to dump</h2>
              <p>
                Stop queuing at the transfer station. Tip the load at a driveway near the
                job instead.
              </p>
              <ul>
                <Bullet>
                  <strong>Free to join</strong> — tree services never pay us a cent
                </Bullet>
                <Bullet>No tip fees, no queue, no round trip to the yard</Bullet>
                <Bullet>Live map filtered to truck size, access and clearance</Bullet>
                <Bullet>Claim a pre-approved pin and go — no phone call needed</Bullet>
              </ul>
              <Link href={supplierTo} className="btn btn-ink btn-lg btn-block">
                Find drop sites near me <Arrow />
              </Link>
              <div className="door-foot">No subscription, no listing fee, no lock-in.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Headline numbers live in StatsBand, deliberately not rendered yet —
          "0 loads delivered" is honest and a terrible advertisement. Switch it
          back on by uncommenting this line once there's a real story in it. */}
      {/* <StatsBand /> */}

      <HowItWorks />
      <MapPreview supplierHref={supplierTo} />

      {/* ---------------- benefits ---------------- */}
      <section>
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">Why bother</span>
            <h2 className="display">
              Woodchip is worth more <span className="green">in a garden</span> than in
              landfill.
            </h2>
          </div>

          <div className="benefit-grid">
            <Benefit
              title="Half the watering"
              body="A 75mm layer of woodchip cuts soil evaporation dramatically — which matters a lot in a Queensland summer."
              icon={<path d="M12 21c0-6 3-10 8-12-1 7-4 11-8 12zM12 21c0-5-2.5-8.5-7-10 .8 6 3.5 9 7 10zM12 21v-6" />}
            />
            <Benefit
              title="Fewer weeds, less digging"
              body="Mulch smothers weed seed before it germinates. Less spraying, less weekend, same garden."
              icon={<><path d="M20.5 6.5 12 15l-3.5-3.5" /><path d="M3 12a9 9 0 1 0 2.6-6.4" /><path d="M3 4v4h4" /></>}
            />
            <Benefit
              title="Cheaper than a pallet of bags"
              body="Bagged mulch runs $9–14 for 50 litres. One delivery drops up to 3 m³ — about 60 bags' worth, for nothing."
              icon={<><path d="M20.6 13.4 12.6 21.4a2 2 0 0 1-2.8 0L2.6 14.2A2 2 0 0 1 2 12.8V4a2 2 0 0 1 2-2h8.8a2 2 0 0 1 1.4.6l6.4 6.4a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.3" /></>}
            />
            <Benefit
              title="An hour back for the crew"
              body="Transfer station queues eat billable time. A driveway two streets away doesn't."
              icon={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
            />
            <Benefit
              title="Tip fees avoided"
              body="Green-waste gate fees keep climbing. Every load tipped locally is a fee the crew doesn't pay."
              icon={<><path d="M4 20V10l8-6 8 6v10" /><path d="M9 20v-6h6v6" /><path d="M2 20h20" /></>}
            />
            <Benefit
              title="No catch"
              body="No fee, no subscription, no card on file. The crew saves a tip fee, you get the mulch, and that's the whole trade."
              icon={<><path d="M12 22s8-4.5 8-11V5l-8-3-8 3v6c0 6.5 8 11 8 11z" /><path d="m9 12 2 2 4-4" /></>}
            />
          </div>
        </div>
      </section>

      <Faq />

      {/* ---------------- closing ---------------- */}
      <section className="closing" id="list">
        <div className="wrap">
          <h2 className="display">
            There&apos;s a truck full of mulch
            <br />
            two suburbs away <span className="green">right now.</span>
          </h2>
          <p className="lead">
            Ninety seconds to list, and it costs you nothing.
          </p>
          <div className="closing-btns">
            <Link href={receiverTo} className="btn btn-white btn-lg">
              Put my pin on the map <Arrow />
            </Link>
            <Link href={supplierTo} className="btn btn-outline-white btn-lg">
              I&apos;m an arborist
            </Link>
          </div>
          <p className="closing-note">
            Starting on the Sunshine Coast. More regions as crews come on board.
          </p>
        </div>
      </section>

      {/* ---------------- footer ---------------- */}
      <footer className="site-footer">
        <div className="wrap">
          <div className="footer-grid">
            <div className="footer-brand">
              <Link href="/" className="logo" aria-label="Mulch2You home">
                <Image
                  src="/wordmark-dark.png"
                  alt="Mulch2You"
                  width={900}
                  height={131}
                  className="logo-img"
                />
              </Link>
              <p>
                Matching tree crews who need to dump woodchip with gardeners who want it
                delivered. One flat fee, paid after the drop.
              </p>
            </div>

            <FooterCol
              title="For homeowners"
              links={[
                { href: receiverTo, label: "List your driveway" },
                { href: "#how", label: "How delivery works" },
                { href: "#faq", label: "FAQ" },
              ]}
            />
            <FooterCol
              title="For arborists"
              links={[
                { href: supplierTo, label: "Find drop sites" },
                { href: "#how", label: "How claiming works" },
              ]}
            />
            <FooterCol
              title="Company"
              links={[
                { href: "#faq", label: "Help" },
                { href: "/privacy", label: "Privacy policy" },
                { href: "/terms", label: "Terms of use" },
              ]}
            />
          </div>

          <div className="footer-bar">
            <div>© {new Date().getFullYear()} Mulch2You.</div>
            <div className="footer-bar-links">
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li>
      <span className="tick">
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2 6.4 4.6 9 10 3.2" />
        </svg>
      </span>
      <span>{children}</span>
    </li>
  );
}


function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}


function Benefit({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="benefit">
      <div className="benefit-icon">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {icon}
        </svg>
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h4>{title}</h4>
      <ul>
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href}>{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
