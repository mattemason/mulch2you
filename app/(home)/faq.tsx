"use client";

import { useRef } from "react";
import { VOLUME_TIERS, formatPrice } from "@/lib/listing-options";

const FAQ = [
  {
    q: "What does it cost?",
    a: `A flat delivery fee based on the load size you choose: ${formatPrice(
      VOLUME_TIERS.small.priceCents,
    )} for up to 3 m³, ${formatPrice(
      VOLUME_TIERS.medium.priceCents,
    )} for up to 6 m³, and ${formatPrice(
      VOLUME_TIERS.large.priceCents,
    )} for a full truck or an open "send me everything" listing. Creating the listing is free, and you're not charged until the mulch is on the ground.`,
  },
  {
    q: "Why isn't it free? Isn't the arborist getting rid of a waste product?",
    a: "The chip is free — the delivery isn't. A crew has to drive a loaded truck to your place and tip it, and the fee covers running the service that gets them there. It's still a fraction of what the same volume costs from a landscape supplier, where you'd pay for the material as well.",
  },
  {
    q: "When am I charged?",
    a: "After the load is delivered and you've confirmed it arrived. The driver photographs the drop to close the job. If nobody comes, or the load never lands, you're never charged a cent.",
  },
  {
    q: "How much mulch actually turns up?",
    a: "Up to the size you selected — a driver won't tip more than you've agreed to take. A full truck is around 10 m³, which covers roughly 100 m² of garden bed at 100mm deep. Be honest about your upper limit: a driver who arrives and can only tip half a load won't come back.",
  },
  {
    q: "What kind of mulch is it?",
    a: "Fresh arborist woodchip — a mix of chipped branches, leaf and bark from whatever the crew pruned or removed that day. It's not screened, dyed or composted. Brilliant on garden beds and paths, and it breaks down into good soil. You can rule out species you don't want when you list: palm, pine, conifer, camphor laurel, privet, thorny species, diseased wood or stump grindings.",
  },
  {
    q: "Can I refuse a load after I've listed?",
    a: 'Yes. By default every request needs your approval before your address is released, and you can pause or delete a listing at any time. If you\'d rather get mulch faster, tick "drop anytime" — drivers can then claim your pin on the spot, which makes it far more likely a truck picks you.',
  },
  {
    q: "Who can see my address?",
    a: "Nobody, until you accept a drop. The map only ever shows your suburb and a pin deliberately offset by a few hundred metres, and only to tree services we've approved by hand. Your street address and phone go to one crew, once you've said yes.",
  },
  {
    q: "Do I need to be home for the drop?",
    a: "Only if you want to be. Plenty of people leave a marked spot and a note. You'll be notified when a crew claims your pin, and you'll get a photo of the pile once it's tipped.",
  },
  {
    q: "What if the driveway can't take a truck?",
    a: "Your listing captures where the truck tips — driveway, nature strip, through a gate, or open ground — along with access notes, and the map filters on all of it. A photo of the spot helps more than anything else: drivers see it before they commit.",
  },
];

export function Faq() {
  // One open at a time, so the list stays scannable.
  const listRef = useRef<HTMLDivElement>(null);

  function closeOthers(current: HTMLDetailsElement) {
    if (!current.open || !listRef.current) return;
    listRef.current.querySelectorAll("details").forEach((d) => {
      if (d !== current) d.open = false;
    });
  }

  return (
    <section className="faq" id="faq">
      <div className="wrap">
        <div className="section-head center">
          <span className="eyebrow">Questions</span>
          <h2 className="display">
            The stuff <span className="green">everyone asks.</span>
          </h2>
        </div>

        <div className="faq-list" ref={listRef}>
          {FAQ.map((item, i) => (
            <details
              className="qa"
              key={item.q}
              open={i === 0}
              onToggle={(e) => closeOthers(e.currentTarget)}
            >
              <summary>
                {item.q}
                <svg
                  className="plus"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </summary>
              <div className="answer">{item.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
