import Image from "next/image";
import Link from "next/link";

/**
 * The wordmark lockup, cut from the master logo by scripts/build-brand-assets.mjs.
 *
 * Two files rather than one: the master is charcoal-on-white, which vanishes on
 * a dark background. The wordmark is flat colour so it can be recoloured
 * cleanly for dark mode — the truck can't, because its cab is white and would
 * dissolve, which is why the full lockup only ever appears on a light surface.
 */
export function Wordmark({
  className = "h-8",
  href = "/",
  priority = false,
}: {
  className?: string;
  href?: string | null;
  priority?: boolean;
}) {
  const img = (
    <>
      <Image
        src="/wordmark.png"
        alt="Mulch2You — we deliver, you benefit"
        width={900}
        height={158}
        priority={priority}
        className={`${className} w-auto dark:hidden`}
      />
      <Image
        src="/wordmark-dark.png"
        alt=""
        aria-hidden
        width={900}
        height={158}
        priority={priority}
        className={`${className} hidden w-auto dark:block`}
      />
    </>
  );

  if (!href) return <span className="inline-flex">{img}</span>;

  return (
    <Link href={href} aria-label="Mulch2You home" className="inline-flex">
      {img}
    </Link>
  );
}

/** The full lockup, truck and all. Light surfaces only — see above. */
export function FullLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Mulch2You — a tipper truck unloading wood chip"
      width={1200}
      height={602}
      priority
      className={className}
    />
  );
}
