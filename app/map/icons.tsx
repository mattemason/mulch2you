/** Shared line icons for the driver screens. */
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const Icon = {
  back: (p: { size?: number }) => (
    <svg width={p.size ?? 22} height={p.size ?? 22} viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  ),
  pin: (p: { size?: number }) => (
    <svg width={p.size ?? 13} height={p.size ?? 13} viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  bolt: (p: { size?: number }) => (
    <svg width={p.size ?? 13} height={p.size ?? 13} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
    </svg>
  ),
  truck: (p: { size?: number }) => (
    <svg width={p.size ?? 13} height={p.size ?? 13} viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M2 16h11V8h4l4 4v4h-2" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  ),
  box: (p: { size?: number }) => (
    <svg width={p.size ?? 13} height={p.size ?? 13} viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M21 16V8l-9-5-9 5v8l9 5z" />
    </svg>
  ),
  leaf: (p: { size?: number }) => (
    <svg width={p.size ?? 13} height={p.size ?? 13} viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M12 21c0-6 3-10 8-12-1 7-4 11-8 12z" />
      <path d="M12 21c0-5-2.5-8.5-7-10 .8 6 3.5 9 7 10z" />
    </svg>
  ),
  clock: (p: { size?: number }) => (
    <svg width={p.size ?? 13} height={p.size ?? 13} viewBox="0 0 24 24" {...stroke} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  chevron: (p: { size?: number }) => (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="m9 6 6 6-6 6" />
    </svg>
  ),
  close: (p: { size?: number }) => (
    <svg width={p.size ?? 15} height={p.size ?? 15} viewBox="0 0 24 24" {...stroke} strokeWidth={2.6} aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  route: (p: { size?: number }) => (
    <svg width={p.size ?? 17} height={p.size ?? 17} viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="m3 11 19-9-9 19-2-8z" />
    </svg>
  ),
  arrow: (p: { size?: number }) => (
    <svg width={p.size ?? 17} height={p.size ?? 17} viewBox="0 0 24 24" {...stroke} strokeWidth={2.5} aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  photo: (p: { size?: number }) => (
    <svg width={p.size ?? 26} height={p.size ?? 26} viewBox="0 0 24 24" {...stroke} strokeWidth={1.8} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m21 16-5-5L5 19" />
    </svg>
  ),
  mapOff: (p: { size?: number }) => (
    <svg width={p.size ?? 42} height={p.size ?? 42} viewBox="0 0 24 24" {...stroke} strokeWidth={1.7} aria-hidden>
      <path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2z" />
      <path d="M9 4v14M15 6v14" />
      <path d="m2 2 20 20" />
    </svg>
  ),
  mapOn: (p: { size?: number }) => (
    <svg width={p.size ?? 15} height={p.size ?? 15} viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  ),
  list: (p: { size?: number }) => (
    <svg width={p.size ?? 15} height={p.size ?? 15} viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  ),
  refresh: (p: { size?: number }) => (
    <svg width={p.size ?? 15} height={p.size ?? 15} viewBox="0 0 24 24" {...stroke} strokeWidth={2.4} aria-hidden>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </svg>
  ),
  locate: (p: { size?: number }) => (
    <svg width={p.size ?? 20} height={p.size ?? 20} viewBox="0 0 24 24" {...stroke} aria-hidden>
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="12" cy="12" r="8" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
    </svg>
  ),
  plus: (p: { size?: number }) => (
    <svg width={p.size ?? 20} height={p.size ?? 20} viewBox="0 0 24 24" {...stroke} strokeWidth={2.4} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  minus: (p: { size?: number }) => (
    <svg width={p.size ?? 20} height={p.size ?? 20} viewBox="0 0 24 24" {...stroke} strokeWidth={2.4} aria-hidden>
      <path d="M5 12h14" />
    </svg>
  ),
  check: (p: { size?: number }) => (
    <svg width={p.size ?? 17} height={p.size ?? 17} viewBox="0 0 24 24" {...stroke} strokeWidth={2.5} aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  ban: (p: { size?: number }) => (
    <svg width={p.size ?? 13} height={p.size ?? 13} viewBox="0 0 24 24" {...stroke} strokeWidth={2.6} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m6 6 12 12" />
    </svg>
  ),
  shield: (p: { size?: number }) => (
    <svg width={p.size ?? 17} height={p.size ?? 17} viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M12 22s8-4.5 8-11V5l-8-3-8 3v6c0 6.5 8 11 8 11z" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  ),
  phone: (p: { size?: number }) => (
    <svg width={p.size ?? 19} height={p.size ?? 19} viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
    </svg>
  ),
};
