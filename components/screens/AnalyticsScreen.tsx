"use client";

import { useMemo, useState } from "react";
import { ChartPanel, HudBarChart, HudLineChart, type SeriesPoint } from "@/components/hud/charts";
import { PageShell, ScreenHeader } from "@/components/hud/PageShell";
import { estimateE1RM } from "@/lib/analytics/e1rm";
import { useMountedNow } from "@/lib/hooks";
import { setVolumeKg, totalLoadKg } from "@/lib/analytics/volume";
import { formatShortDate } from "@/lib/format";
import { displayWeight } from "@/lib/units";
import { useAllSets, useLifts, usePrefs } from "@/lib/queries";
import { cn } from "@/lib/utils";

const DATE_RANGES = [
  { key: "30", label: "30D", days: 30 },
  { key: "90", label: "90D", days: 90 },
  { key: "180", label: "180D", days: 180 },
  { key: "all", label: "ALL", days: null },
] as const;

const REP_RANGES = [
  { key: "all", label: "ALL REPS", min: 1, max: Infinity },
  { key: "1-5", label: "1–5", min: 1, max: 5 },
  { key: "6-12", label: "6–12", min: 6, max: 12 },
  { key: "13+", label: "13+", min: 13, max: Infinity },
] as const;

function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function weekStart(ts: number): number {
  const d = new Date(dayStart(ts));
  const diff = (d.getDay() - 1 + 7) % 7; // Monday
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

export function AnalyticsScreen() {
  const { data: prefs } = usePrefs();
  const { data: lifts } = useLifts();
  const { data: allSets } = useAllSets();
  const [liftId, setLiftId] = useState<string | null>(null);
  const [rangeKey, setRangeKey] = useState<(typeof DATE_RANGES)[number]["key"]>("90");
  const [repKey, setRepKey] = useState<(typeof REP_RANGES)[number]["key"]>("all");

  const unit = prefs?.unit ?? "lb";
  const selectedLift = useMemo(
    () => lifts?.find((l) => l.id === liftId) ?? lifts?.[0] ?? null,
    [lifts, liftId],
  );

  const now = useMountedNow();

  const filtered = useMemo(() => {
    if (!allSets || !selectedLift) return [];
    const range = DATE_RANGES.find((r) => r.key === rangeKey)!;
    const reps = REP_RANGES.find((r) => r.key === repKey)!;
    const cutoff = range.days === null ? 0 : now - range.days * 86_400_000;
    return allSets
      .filter(
        (s) =>
          s.liftId === selectedLift.id &&
          s.createdAt >= cutoff &&
          s.reps >= reps.min &&
          s.reps <= reps.max,
      )
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [allSets, selectedLift, rangeKey, repKey, now]);

  const bodyweightKg = prefs?.bodyweightKg ?? null;

  const { e1rmTrend, topSetTrend, weeklyVolume, rpeDist } = useMemo(() => {
    const e1rmByDay = new Map<number, number>();
    const topByDay = new Map<number, number>();
    const volByWeek = new Map<number, number>();
    const rpeBins = new Map<number, number>();

    if (selectedLift) {
      for (const set of filtered) {
        const load = totalLoadKg(set, selectedLift, bodyweightKg);
        const day = dayStart(set.createdAt);
        const est = estimateE1RM(load, set.reps);
        if (est) {
          e1rmByDay.set(day, Math.max(e1rmByDay.get(day) ?? 0, est.epley));
        }
        if (load > 0) {
          topByDay.set(day, Math.max(topByDay.get(day) ?? 0, load));
        }
        const week = weekStart(set.createdAt);
        volByWeek.set(
          week,
          (volByWeek.get(week) ?? 0) + setVolumeKg(set, selectedLift, bodyweightKg),
        );
        if (set.rpe !== null) {
          const bin = Math.max(5, Math.min(10, set.rpe));
          rpeBins.set(bin, (rpeBins.get(bin) ?? 0) + 1);
        }
      }
    }

    // Convert to the DISPLAY unit here so axis ticks land on clean numbers
    // in what the user actually reads (nice-in-kg ≠ nice-in-lb).
    const toSeries = (map: Map<number, number>): SeriesPoint[] =>
      [...map.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([ts, v]) => ({
          x: ts,
          y: displayWeight(v, unit),
          label: formatShortDate(ts),
        }));

    const rpeSeries: SeriesPoint[] = [];
    for (let bin = 5; bin <= 10; bin += 0.5) {
      rpeSeries.push({
        x: bin,
        y: rpeBins.get(bin) ?? 0,
        label: bin === 5 ? "≤5" : String(bin),
      });
    }
    const hasRpe = rpeSeries.some((p) => p.y > 0);

    return {
      e1rmTrend: toSeries(e1rmByDay),
      topSetTrend: toSeries(topByDay),
      weeklyVolume: toSeries(volByWeek),
      rpeDist: hasRpe ? rpeSeries : [],
    };
  }, [filtered, selectedLift, bodyweightKg, unit]);

  const fmtWeight = (v: number) => String(Math.round(v));
  const fmtVol = (v: number) =>
    v >= 10_000
      ? `${Math.round(v / 1000)}k`
      : Math.round(v).toLocaleString("en-US");

  return (
    <PageShell>
      <ScreenHeader title="Analytics" eyebrow="Progression telemetry" />

      {/* Lift selector */}
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(lifts ?? []).map((lift) => {
          const active = lift.id === selectedLift?.id;
          return (
            <button
              key={lift.id}
              type="button"
              aria-pressed={active}
              onClick={() => setLiftId(lift.id)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2.5 text-[13px] font-medium transition-all",
                active
                  ? "border-forge-cyan/60 bg-forge-cyan/10 text-forge-cyan-hi"
                  : "border-forge-cyan/15 text-muted-foreground hover:border-forge-cyan/35 hover:text-foreground",
              )}
            >
              {lift.name}
            </button>
          );
        })}
      </div>

      {/* Filters: date range + rep range */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Date range" className="flex gap-1">
          {DATE_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={rangeKey === r.key}
              onClick={() => setRangeKey(r.key)}
              className={cn(
                "min-h-10 rounded-lg border px-3 text-xs font-medium transition-colors",
                rangeKey === r.key
                  ? "border-forge-cyan/50 bg-forge-cyan/10 text-forge-cyan-hi"
                  : "border-forge-cyan/15 text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Rep range" className="flex gap-1">
          {REP_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={repKey === r.key}
              onClick={() => setRepKey(r.key)}
              className={cn(
                "min-h-10 rounded-lg border px-3 text-xs font-medium transition-colors",
                repKey === r.key
                  ? "border-white/40 bg-white/10 text-foreground"
                  : "border-forge-cyan/15 text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartPanel
          title={`e1RM trend (${unit})`}
          subtitle="Epley, best per day"
          table={[
            ["Date", `e1RM (${unit})`],
            ...e1rmTrend.map((p) => [p.label, fmtWeight(p.y)]),
          ]}
        >
          <HudLineChart points={e1rmTrend} color="#ffffff" formatY={fmtWeight} />
        </ChartPanel>

        <ChartPanel
          title={`Top set (${unit})`}
          subtitle="Heaviest load per day"
          table={[
            ["Date", `Top set (${unit})`],
            ...topSetTrend.map((p) => [p.label, fmtWeight(p.y)]),
          ]}
        >
          <HudLineChart points={topSetTrend} color="#a1a1a8" formatY={fmtWeight} />
        </ChartPanel>

        <ChartPanel
          title={`Weekly volume (${unit})`}
          subtitle="Σ load × reps"
          table={[
            ["Week of", `Volume (${unit})`],
            ...weeklyVolume.map((p) => [p.label, fmtVol(p.y)]),
          ]}
        >
          <HudBarChart points={weeklyVolume} color="#ffffff" formatY={fmtVol} />
        </ChartPanel>

        <ChartPanel
          title="RPE distribution"
          subtitle="Rated sets in range"
          table={[
            ["RPE", "Sets"],
            ...rpeDist.map((p) => [p.label, String(p.y)]),
          ]}
        >
          <HudBarChart
            points={rpeDist}
            color="#a1a1a8"
            formatY={(v) => String(Math.round(v))}
            emptyLabel="No rated sets in range"
          />
        </ChartPanel>
      </div>
    </PageShell>
  );
}
