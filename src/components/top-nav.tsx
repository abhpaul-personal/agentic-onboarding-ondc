"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Overview" },
  { href: "/demo", label: "Run the demo" },
  { href: "/scorecard", label: "Scorecard" },
  { href: "/kit", label: "Eval kit" },
] as const;

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--bg)]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-center gap-5 px-5 py-3">
        <div className="flex flex-col">
          <b className="text-[16px] tracking-tight">Agentic Onboarding for ONDC Sellers</b>
          <span className="text-xs text-[var(--ink2)]">
            Case study · personal project · not affiliated with ONDC
          </span>
        </div>
        <nav className="ml-auto flex flex-wrap gap-1">
          {TABS.map((tab) => {
            const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`rounded-lg px-3 py-1.5 font-medium no-underline ${
                  active ? "bg-[var(--ink)] text-white" : "text-[var(--ink2)] hover:text-[var(--ink)]"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
