"use client";

import { ChartLine, Dumbbell, History, Orbit } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BASE_PATH } from "@/lib/basePath";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Nexus", icon: Orbit },
  { href: "/log", label: "Log", icon: Dumbbell },
  { href: "/history", label: "History", icon: History },
  { href: "/analytics", label: "Analytics", icon: ChartLine },
] as const;

/**
 * Offline, the app-router transition silently stalls (its RSC fetch can't
 * run); fall back to a full-page load — the service worker serves the
 * precached document + chunks instantly.
 */
function offlineFallbackNav(e: React.MouseEvent, href: string) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    e.preventDefault();
    window.location.assign(`${BASE_PATH}${href}` || "/");
  }
}

/**
 * Primary navigation: bottom HUD dock on mobile, left rail on desktop.
 * Quick Log is never more than one tap away.
 */
export function DockNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile bottom dock */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-white/10 bg-[#161618]/90 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex items-stretch justify-around">
          {ITEMS.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={(e) => offlineFallbackNav(e, href)}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  <span className="text-[10px] font-medium">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop rail */}
      <nav
        aria-label="Primary"
        className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col items-center justify-center gap-2 border-r border-white/10 bg-[#0e0e10]/90 backdrop-blur-xl md:flex"
      >
        <div className="absolute top-6 text-sm font-semibold text-foreground">L</div>
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              onClick={(e) => offlineFallbackNav(e, href)}
              className={cn(
                "group flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl border transition-all",
                active
                  ? "border-white/15 bg-white/10 text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="text-[9px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
