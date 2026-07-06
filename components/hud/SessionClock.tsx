"use client";

import { useEffect, useState } from "react";

export function formatHMS(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Live session clock: "SESSION // LIVE" with pulsing dot + elapsed HH:MM:SS. */
export function SessionClock({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="animate-live-dot h-2 w-2 rounded-full bg-forge-cyan glow-cyan"
      />
      <span className="hud-label text-muted-foreground">Live</span>
      <span className="tabular ml-1 text-lg font-semibold text-foreground">
        {formatHMS(now - startedAt)}
      </span>
    </div>
  );
}
