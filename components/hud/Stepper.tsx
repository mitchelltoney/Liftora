"use client";

import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Oversized numeric entry cluster: the heart of the logger.
 * Big tabular readout, thumb-height stepper buttons, hold-to-repeat,
 * full keyboard operability (input is a real <input type=number>).
 */
export function Stepper({
  label,
  value,
  onChange,
  step,
  min,
  max,
  unit,
  accent = "cyan",
  format = (v) => String(v),
  inputId,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step: number;
  min?: number;
  max?: number;
  unit?: string;
  accent?: "cyan" | "magenta";
  format?: (v: number) => string;
  inputId: string;
}) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const clamp = useCallback(
    (v: number) => {
      let next = Math.round(v * 1000) / 1000;
      if (min !== undefined) next = Math.max(min, next);
      if (max !== undefined) next = Math.min(max, next);
      return next;
    },
    [min, max],
  );

  const bump = useCallback(
    (dir: 1 | -1) => {
      onChange(clamp(valueRef.current + dir * step));
    },
    [clamp, onChange, step],
  );

  const stopHold = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (holdInterval.current) clearInterval(holdInterval.current);
    holdTimer.current = null;
    holdInterval.current = null;
  }, []);

  const startHold = useCallback(
    (dir: 1 | -1) => {
      bump(dir);
      holdTimer.current = setTimeout(() => {
        holdInterval.current = setInterval(() => bump(dir), 90);
      }, 450);
    },
    [bump],
  );

  useEffect(() => stopHold, [stopHold]);

  const accentText =
    accent === "magenta" ? "text-forge-magenta" : "text-forge-cyan-hi";

  return (
    <div className="glass-panel flex flex-col items-center gap-1 p-3">
      <label htmlFor={inputId} className="hud-label text-muted-foreground">
        {label}
      </label>
      <div className="flex items-baseline gap-1">
        <input
          id={inputId}
          type="number"
          inputMode="decimal"
          step={step}
          value={Number.isInteger(value) ? value : String(value)}
          min={min}
          max={max}
          onChange={(e) => {
            const parsed = Number(e.target.value);
            if (Number.isFinite(parsed)) onChange(clamp(parsed));
          }}
          className={cn(
            "tabular w-full bg-transparent text-center text-4xl font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            accentText,
          )}
          aria-label={label}
        />
        {unit ? (
          <span className="hud-label shrink-0 text-muted-foreground">{unit}</span>
        ) : null}
      </div>
      <div className="sr-only" aria-live="polite">
        {label} {format(value)}
      </div>
      <div className="flex w-full gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          className="flex min-h-12 flex-1 items-center justify-center rounded-lg border border-forge-cyan/20 bg-forge-panel-hi text-foreground transition-transform active:scale-95 hover:border-forge-cyan/40"
          onPointerDown={(e) => {
            e.preventDefault();
            startHold(-1);
          }}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              bump(-1);
            }
          }}
        >
          <Minus className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          className="flex min-h-12 flex-1 items-center justify-center rounded-lg border border-forge-cyan/20 bg-forge-panel-hi text-foreground transition-transform active:scale-95 hover:border-forge-cyan/40"
          onPointerDown={(e) => {
            e.preventDefault();
            startHold(1);
          }}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              bump(1);
            }
          }}
        >
          <Plus className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
