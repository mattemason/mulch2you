/** Decorative hero illustration, from the homepage template. */
export function HeroTruck() {
  return (
    <svg className="hero-truck" viewBox="0 0 620 300" aria-hidden>
      {/* mulch pile, tipping out the back */}
      <path
        d="M396 142 q56 24 96 72 q18 22 -8 26 q-76 12 -138 2 q-22 -4 -13 -21 q21 -45 63 -79z"
        fill="#A9752F"
      />
      <path d="M404 164 q42 22 70 60 q-64 10 -114 2 q15 -36 44 -62z" fill="#C08F4A" />
      <g fill="#8A5A2B" opacity=".9">
        <ellipse cx="436" cy="196" rx="10" ry="4.2" transform="rotate(-24 436 196)" />
        <ellipse cx="474" cy="218" rx="8" ry="3.6" transform="rotate(16 474 218)" />
        <ellipse cx="408" cy="222" rx="9" ry="3.8" transform="rotate(-6 408 222)" />
        <ellipse cx="452" cy="232" rx="7" ry="3.2" transform="rotate(9 452 232)" />
      </g>
      <g fill="#4FA33C" opacity=".85">
        <ellipse cx="470" cy="170" rx="8" ry="3.6" transform="rotate(-34 470 170)" />
        <ellipse cx="422" cy="178" rx="7" ry="3.2" transform="rotate(26 422 178)" />
        <ellipse cx="498" cy="206" rx="6" ry="2.8" transform="rotate(-12 498 206)" />
      </g>

      {/* tipper body, hinged at the rear of the chassis */}
      <g transform="rotate(20 400 176)">
        <rect x="222" y="62" width="178" height="114" rx="6" fill="#4E6B2E" />
        <rect x="222" y="62" width="178" height="20" rx="6" fill="#3E5624" />
        <g stroke="#3E5624" strokeWidth="4" opacity=".85">
          <line x1="254" y1="82" x2="254" y2="176" />
          <line x1="290" y1="82" x2="290" y2="176" />
          <line x1="326" y1="82" x2="326" y2="176" />
          <line x1="362" y1="82" x2="362" y2="176" />
        </g>
      </g>

      {/* hydraulic ram */}
      <rect
        x="252"
        y="182"
        width="72"
        height="11"
        rx="5.5"
        fill="#9AA491"
        transform="rotate(-40 252 182)"
      />

      {/* cab */}
      <rect x="54" y="92" width="110" height="86" rx="12" fill="#fff" stroke="#14170F" strokeWidth="6" />
      <rect x="70" y="108" width="48" height="36" rx="6" fill="#D8E2CE" />
      <text
        x="80"
        y="170"
        fontFamily="var(--font-display), 'Arial Narrow', Impact, sans-serif"
        fontSize="22"
        fill="#2E7D22"
        transform="skewX(-8)"
        textLength="46"
        lengthAdjust="spacingAndGlyphs"
      >
        M2Y
      </text>

      {/* chassis */}
      <rect x="150" y="176" width="256" height="26" rx="5" fill="#14170F" />
      <rect x="52" y="176" width="104" height="20" rx="5" fill="#14170F" />

      {/* wheels */}
      {[118, 280, 356].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="214" r="34" fill="#14170F" />
          <circle cx={cx} cy="214" r="15" fill="#B8BEB0" />
          <circle cx={cx} cy="214" r="6" fill="#5C6455" />
        </g>
      ))}

      <rect x="56" y="250" width="470" height="5" rx="2.5" fill="#14170F" opacity=".12" />
    </svg>
  );
}
