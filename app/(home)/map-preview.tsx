"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * An illustration of the supplier map, not the map itself.
 *
 * The sites below are made up, which is fine for showing how the screen works
 * but would not be fine presented as real inventory — hence the note under the
 * list. Real pins are behind sign-in, because they're people's homes.
 */
const SITES = [
  {
    id: "1",
    volume: "8m³",
    suburb: "Auchenflower",
    tag: "Drop anytime",
    tagClass: "tag",
    meta: "2.4km · 6 min detour · No approval needed",
    attrs: ["🚚 Truck OK", "↕ 4.2m clear"],
    x: 206,
    y: 246,
    colour: "#2E7D22",
    badge: "8",
  },
  {
    id: "2",
    volume: "20m³",
    suburb: "Red Hill",
    tag: "Wants it today",
    tagClass: "tag tag--urgent",
    meta: "3.8km · 9 min detour · Acreage — send everything",
    attrs: ["🚚 Semi OK", "↕ Open sky"],
    x: 452,
    y: 168,
    colour: "#8A5A2B",
    badge: "20",
    urgent: true,
  },
  {
    id: "3",
    volume: "4m³",
    suburb: "Bardon East",
    tag: "Approve first",
    tagClass: "tag",
    meta: "5.1km · 14 min detour · Sat mornings · No palm",
    attrs: ["🚚 6-tonne max", "↕ 3.1m clear"],
    x: 596,
    y: 392,
    colour: "#2E7D22",
    badge: "4",
  },
  {
    id: "4",
    volume: "6m³",
    suburb: "Bardon",
    tag: "Repeat taker",
    tagClass: "tag tag--big",
    meta: "5.6km · 15 min detour · Any day",
    attrs: ["🚚 Truck OK", "↕ 3.8m clear"],
    x: 288,
    y: 448,
    colour: "#4FA33C",
    badge: "6",
  },
];

export function MapPreview({ supplierHref }: { supplierHref: string }) {
  const [active, setActive] = useState<string | null>(null);

  return (
    <section className="map-section" id="map">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">The arborist&apos;s view</span>
          <h2 className="display">
            Every driveway <span className="green">on one map.</span>
          </h2>
          <p className="lead">
            This is what a tree crew sees when they open Mulch2You: drop sites near the
            job, filtered to what their truck can actually service.
          </p>
        </div>

        <div className="map-layout">
          <div className="map-frame">
            <div className="map-toolbar">
              <div className="map-search">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                Within 15km of the job
              </div>
              <div className="chip on">All sizes</div>
              <div className="chip">Truck access</div>
            </div>

            <svg
              className="map-canvas"
              viewBox="0 0 760 520"
              preserveAspectRatio="xMidYMid slice"
              role="img"
              aria-label="Illustration of drop sites on a map"
            >
              <rect width="760" height="520" fill="#EEF2E8" />
              <path d="M40 330 q70-40 150-14 q40 60-20 100 q-90 24-130-30z" fill="#DCE9D3" />
              <path d="M560 60 q90-20 140 30 q10 60-60 76 q-90 6-100-50z" fill="#DCE9D3" />
              <path
                d="M-20 190 q140 40 250-10 q120-54 250 10 q90 44 300 6"
                stroke="#CBDDE8"
                strokeWidth="42"
                fill="none"
                strokeLinecap="round"
              />
              <g stroke="#fff" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M0 120h760" strokeWidth="12" />
                <path d="M0 280h760" strokeWidth="16" />
                <path d="M0 420h760" strokeWidth="10" />
                <path d="M130 0v520" strokeWidth="14" />
                <path d="M330 0v520" strokeWidth="10" />
                <path d="M520 0v520" strokeWidth="12" />
                <path d="M660 0v520" strokeWidth="9" />
                <path d="M0 40 L200 40 L330 130" strokeWidth="7" />
                <path d="M520 350 L660 470" strokeWidth="7" />
              </g>
              <g stroke="#F3C86A" fill="none" strokeWidth="5" opacity=".8" strokeDasharray="14 12">
                <path d="M0 280h760" />
                <path d="M330 0v520" />
              </g>
              <g fill="#E2E7DA">
                <rect x="30" y="150" width="70" height="48" rx="4" />
                <rect x="160" y="150" width="90" height="48" rx="4" />
                <rect x="360" y="310" width="80" height="52" rx="4" />
                <rect x="560" y="310" width="70" height="52" rx="4" />
                <rect x="160" y="440" width="90" height="44" rx="4" />
                <rect x="560" y="150" width="60" height="44" rx="4" />
                <rect x="380" y="60" width="70" height="40" rx="4" />
              </g>

              {SITES.map((s) => (
                <g
                  key={s.id}
                  className={`pin${active === s.id ? " active" : ""}`}
                  transform={`translate(${s.x},${s.y})`}
                  onMouseEnter={() => setActive(s.id)}
                  onMouseLeave={() => setActive(null)}
                >
                  <g className="pin-body">
                    <path
                      d="M0-40a19 19 0 0 1 19 19c0 14-19 29-19 29S-19 -7-19 -21A19 19 0 0 1 0-40z"
                      fill={s.colour}
                    />
                    <circle cx="0" cy="-21" r="8" fill="#fff" />
                    <text
                      x="0"
                      y="-17"
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="800"
                      fill={s.colour}
                    >
                      {s.badge}
                    </text>
                  </g>
                </g>
              ))}

              <g transform="translate(376,300)">
                <circle r="30" fill="#2E7D22" opacity=".13" />
                <circle r="9" fill="#1E63FF" stroke="#fff" strokeWidth="3.5" />
              </g>
            </svg>

            <div className="map-legend">
              <div className="legend-row">
                <span className="legend-dot" style={{ background: "#2E7D22" }} /> Open — will take a
                load
              </div>
              <div className="legend-row">
                <span className="legend-dot" style={{ background: "#8A5A2B" }} /> Wants it gone today
              </div>
              <div className="legend-row">
                <span className="legend-dot" style={{ background: "#1E63FF" }} /> Your current job
                site
              </div>
            </div>
          </div>

          <div>
            <div className="listings-head">
              <h3>Drop sites within 15km</h3>
              <span>Sorted by detour</span>
            </div>
            <div className="listings">
              {SITES.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={`listing${s.urgent ? " listing--urgent" : ""}${
                    active === s.id ? " active" : ""
                  }`}
                  onMouseEnter={() => setActive(s.id)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(s.id)}
                  onBlur={() => setActive(null)}
                >
                  <div className="listing-badge">{s.volume}</div>
                  <div className="listing-main">
                    <div className="listing-title">
                      {s.suburb} <span className={s.tagClass}>{s.tag}</span>
                    </div>
                    <div className="listing-meta">{s.meta}</div>
                    <div className="listing-attrs">
                      {s.attrs.map((a) => (
                        <span key={a}>{a}</span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <p className="demo-note">
              An illustration — real drop sites are only visible to approved tree services,
              because every pin is someone&apos;s home.
            </p>
            <Link href={supplierHref} className="btn btn-ghost btn-block" style={{ marginTop: 14 }}>
              Open the real map
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
