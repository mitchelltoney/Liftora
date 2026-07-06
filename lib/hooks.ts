"use client";

import { useState, useSyncExternalStore } from "react";

/** Reactive media query via external-store subscription (SSR-safe: false). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Timestamp captured once per mount — for date-range filtering in render. */
export function useMountedNow(): number {
  const [now] = useState(() => Date.now());
  return now;
}
