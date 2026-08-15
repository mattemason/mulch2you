"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/suppliers", label: "Tree services" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/drops", label: "Drops" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        // Exact match for the overview, prefix match for the rest, so
        // /admin/listings doesn't also light up Overview.
        const active = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-brand text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
