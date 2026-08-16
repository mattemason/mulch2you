import Link from "next/link";

/**
 * The wordmark, set in type rather than served as artwork.
 *
 * The supplied logo has MULCH2YOU baked into its pixels, so after the rename it
 * couldn't be used without the site showing two different names at once. Anton
 * is already loaded for the marketing headings and is what the logo is set in,
 * so this is a close stand-in: same uppercase, same skew, same green digit.
 *
 * Swap it back for <Image> once there's a MULCH2U file — the truck icons need
 * no change, since they carry no text.
 */
export function Wordmark({
  size = 22,
  href = "/",
  tone = "auto",
  className = "",
}: {
  /** Cap height in pixels, roughly. */
  size?: number;
  href?: string | null;
  /**
   * "auto" follows the theme. The marketing page is light-only and the footer
   * is dark, so both pin their own rather than inheriting a theme they don't use.
   */
  tone?: "auto" | "ink" | "light";
  className?: string;
}) {
  const ink =
    tone === "light" ? "text-white" : tone === "ink" ? "text-[#14170f]" : "text-foreground";
  const accent =
    tone === "light" ? "text-[#8fbf63]" : tone === "ink" ? "text-[#2e7d22]" : "text-brand";

  const mark = (
    <span
      className={`inline-block select-none leading-none tracking-tight ${ink} ${className}`}
      style={{
        fontFamily: "var(--font-display), 'Arial Narrow', Impact, sans-serif",
        fontSize: `${size}px`,
        transform: "skewX(-6deg)",
      }}
    >
      MULCH<span className={accent}>2</span>U
    </span>
  );

  if (!href) return mark;

  return (
    <Link href={href} aria-label="Mulch2U home" className="inline-flex">
      {mark}
    </Link>
  );
}
