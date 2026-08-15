"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#map", label: "Find mulch" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="site-header">
        <div className="wrap">
          <Link href="/" className="logo" aria-label="Mulch2You home">
            <Image src="/wordmark.png" alt="Mulch2You" width={900} height={131} priority className="logo-img" />
          </Link>

          <nav className="nav-links">
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>
                {n.label}
              </a>
            ))}
          </nav>

          <div className="nav-actions">
            <Link href="/signin?role=supplier" className="btn btn-ghost">
              I&apos;m an arborist
            </Link>
            <Link href={signedIn ? "/dashboard" : "/signin?role=receiver"} className="btn btn-green">
              {signedIn ? "Go to dashboard" : "Get mulch delivered"}
            </Link>
          </div>

          <button
            className="burger"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      <div className={`mobile-nav${open ? " open" : ""}`} onClick={() => setOpen(false)}>
        {NAV.map((n) => (
          <a key={n.href} href={n.href}>
            {n.label}
          </a>
        ))}
        <Link href={signedIn ? "/dashboard" : "/signin"}>
          {signedIn ? "Dashboard" : "Log in"}
        </Link>
        <Link href="/signin?role=receiver" className="btn btn-green btn-block">
          Get mulch delivered
        </Link>
        <Link
          href="/signin?role=supplier"
          className="btn btn-ghost btn-block"
          style={{ marginTop: 10 }}
        >
          I&apos;m an arborist
        </Link>
      </div>
    </>
  );
}
