"use client";

import { useState } from "react";

const HOME_STEPS = [
  {
    title: "Drop a pin",
    body: "Mark where the truck should tip. Driveway, side yard, back of the paddock — you decide.",
  },
  {
    title: "Pick a load size",
    body: "A ute load through to a full truck. Be honest about your ceiling — a driver who can only tip half a load won't come back.",
  },
  {
    title: "Get matched",
    body: 'A crew working nearby claims your pin. Approve each request, or tick "drop anytime" and let them come.',
  },
  {
    title: "It turns up",
    body: "They tip it and photograph the load, so you've got a record of what arrived.",
  },
];

const ARB_STEPS = [
  {
    title: "Open the map",
    body: "Every drop site near your job, colour-coded by load size and how urgently they want it gone.",
  },
  {
    title: "Filter to fit",
    body: "Truck size, gate width, overhead clearance, species they won't take. Only see sites you can service.",
  },
  {
    title: "Claim and tip",
    body: 'One tap. Sites marked "drop anytime" release the address instantly — no phone call, no waiting on approval.',
  },
  {
    title: "Close the job",
    body: "Snap a photo of the tipped load and you're done. No weighbridge, no gate fee, no round trip.",
  },
];

export function HowItWorks() {
  const [tab, setTab] = useState<"home" | "arb">("home");
  const steps = tab === "home" ? HOME_STEPS : ARB_STEPS;

  return (
    <section className="how" id="how">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">How it works</span>
          <h2 className="display">
            Two sides. Four steps.
            <br />
            Nothing <span className="green">to pay.</span>
          </h2>
          <p className="lead">Pick your side of the fence.</p>
        </div>

        <div className="tabs" role="tablist" aria-label="How it works">
          <button
            className="tab"
            role="tab"
            aria-selected={tab === "home"}
            aria-controls="panel-home"
            onClick={() => setTab("home")}
          >
            <HomeIcon /> I want it delivered
          </button>
          <button
            className="tab"
            role="tab"
            aria-selected={tab === "arb"}
            aria-controls="panel-arb"
            onClick={() => setTab("arb")}
          >
            <TruckIcon /> I&apos;m an arborist
          </button>
        </div>

        <div
          className={tab === "home" ? "panel panel--home" : "panel panel--arb"}
          id={tab === "home" ? "panel-home" : "panel-arb"}
          role="tabpanel"
        >
          <div className="steps">
            {steps.map((s, i) => (
              <div className="step" key={s.title}>
                <div className="step-num">{String(i + 1).padStart(2, "0")}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HomeIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 16h11V8h4l4 4v4h-2" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}
