"use client";

import { useEffect, useRef } from "react";
import type { gsap as GsapType } from "gsap";
import { useMediaQuery } from "@/lib/hooks";
import { usePrefs } from "@/lib/queries";

/**
 * Screen-level gold flourish for PRs: a luminous line sweeps across the
 * top of the HUD while a soft gold vignette breathes once. GSAP-choreographed,
 * fires only with genuine PRs (parent bumps `trigger`), and stands down
 * entirely under reduced motion. Gold stays sacred.
 */
export function PRFlourish({ trigger }: { trigger: number }) {
  const sweep = useRef<HTMLDivElement>(null);
  const vignette = useRef<HTMLDivElement>(null);
  const systemReduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { data: prefs } = usePrefs();
  const reduced = systemReduced || Boolean(prefs?.reducedMotion);

  useEffect(() => {
    if (trigger <= 0 || reduced || !sweep.current || !vignette.current) return;
    let tl: ReturnType<typeof GsapType.timeline> | null = null;
    let cancelled = false;
    // Lazy: gsap stays out of the route's initial bundle (3D chunks own it).
    void import("gsap").then(({ gsap }) => {
      if (cancelled || !sweep.current || !vignette.current) return;
      tl = gsap.timeline();
      tl.set(sweep.current, { xPercent: -110, opacity: 1 })
      .set(vignette.current, { opacity: 0 })
      .to(
        vignette.current,
        { opacity: 1, duration: 0.28, ease: "power2.out" },
        0,
      )
      .to(
        sweep.current,
        { xPercent: 110, duration: 0.85, ease: "power3.inOut" },
        0.05,
      )
        .to(
          vignette.current,
          { opacity: 0, duration: 0.9, ease: "power2.inOut" },
          0.5,
        )
        .set(sweep.current, { opacity: 0 });
    });
    return () => {
      cancelled = true;
      tl?.kill();
    };
  }, [trigger, reduced]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50">
      <div
        ref={vignette}
        className="absolute inset-0 opacity-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(251,191,36,0.16) 100%)",
        }}
      />
      <div
        ref={sweep}
        className="absolute left-0 right-0 top-0 h-0.5 opacity-0"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(251,191,36,0.95), rgba(255,236,179,1), rgba(251,191,36,0.95), transparent)",
          boxShadow: "0 0 22px rgba(251,191,36,0.8)",
        }}
      />
    </div>
  );
}
