"use client";

import { TimerReset, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function formatMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * Rest countdown HUD strip. Auto-starts on set save (parent sets endsAt),
 * drains a luminous progress line, announces completion politely.
 */
export function RestTimer({
  endsAt,
  durationSeconds,
  onDismiss,
  onRestart,
}: {
  /** Epoch ms when rest completes; null = hidden. */
  endsAt: number | null;
  durationSeconds: number;
  onDismiss: () => void;
  onRestart: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [endsAt]);

  if (endsAt === null) return null;

  const remaining = (endsAt - now) / 1000;
  const done = remaining <= 0;
  const fraction = Math.min(1, Math.max(0, remaining / durationSeconds));

  return (
    <div
      className={cn(
        "glass-panel relative flex items-center gap-3 overflow-hidden px-4 py-2",
        done && "border-forge-cyan/50",
      )}
      role="timer"
      aria-live={done ? "polite" : "off"}
      aria-label={done ? "Rest complete" : `Rest: ${formatMMSS(remaining)} remaining`}
    >
      <span className="hud-label text-muted-foreground">
        {done ? "REST COMPLETE" : "REST"}
      </span>
      <span
        className={cn(
          "tabular text-lg font-semibold",
          done ? "text-forge-cyan text-glow-cyan" : "text-foreground",
        )}
      >
        {formatMMSS(remaining)}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={onRestart}
          aria-label="Restart rest timer"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
        >
          <TimerReset className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss rest timer"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {/* Draining progress line */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-forge-cyan/70"
        style={{ transform: `scaleX(${done ? 1 : fraction})` }}
      />
    </div>
  );
}
