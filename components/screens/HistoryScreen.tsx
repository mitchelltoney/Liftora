"use client";

import { Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageShell, ScreenHeader } from "@/components/hud/PageShell";
import { trainingDayCounts } from "@/lib/analytics/streak";
import { useMountedNow } from "@/lib/hooks";
import { totalVolumeKg } from "@/lib/analytics/volume";
import { formatDate, formatDisplayWeight, formatDuration, formatShortDate, formatVolume } from "@/lib/format";
import type { PR } from "@/lib/types";
import {
  useAllSets,
  useCompletedSessions,
  useLifts,
  usePRs,
  usePrefs,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

const PR_TYPE_LABEL: Record<PR["type"], string> = {
  weight: "WEIGHT",
  reps: "REPS",
  e1rm: "e1RM",
  volume: "VOLUME",
};

const WEEKS_SHOWN = 26;

/** Sequential monochrome ramp: identity = magnitude of training that day. */
function heatColor(count: number, max: number): string {
  if (count === 0) return "rgba(255, 255, 255, 0.07)";
  const t = Math.min(1, count / Math.max(1, max));
  const alpha = 0.25 + t * 0.75;
  return `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
}

function CalendarHeatmap({ dayCounts }: { dayCounts: Map<number, number> }) {
  const now = useMountedNow();
  const scroller = useRef<HTMLDivElement>(null);
  // Recent weeks matter most: land scrolled to the right edge.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);
  const { weeks, monthLabels, maxCount } = useMemo(() => {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    // End the grid on the current week's Monday start.
    const end = new Date(today);
    const diff = (end.getDay() - 1 + 7) % 7;
    end.setDate(end.getDate() - diff);

    const weeks: { ts: number; count: number; inFuture: boolean }[][] = [];
    const monthLabels: { index: number; label: string }[] = [];
    let lastMonth = -1;
    let max = 0;

    for (let w = WEEKS_SHOWN - 1; w >= 0; w--) {
      const weekStart = new Date(end);
      weekStart.setDate(weekStart.getDate() - w * 7);
      const days: { ts: number; count: number; inFuture: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + d);
        const ts = day.getTime();
        const count = dayCounts.get(ts) ?? 0;
        max = Math.max(max, count);
        days.push({ ts, count, inFuture: ts > now });
      }
      const month = weekStart.getMonth();
      if (month !== lastMonth) {
        monthLabels.push({
          index: weeks.length,
          label: weekStart.toLocaleDateString(undefined, { month: "short" }),
        });
        lastMonth = month;
      }
      weeks.push(days);
    }
    return { weeks, monthLabels, maxCount: max };
  }, [dayCounts, now]);

  return (
    <div ref={scroller} className="overflow-x-auto pb-1">
      <div className="min-w-[540px]">
        <div className="relative mb-1 h-4">
          {monthLabels.map((m) => (
            <span
              key={`${m.label}-${m.index}`}
              className="hud-label absolute text-muted-foreground"
              style={{ left: `${(m.index / WEEKS_SHOWN) * 100}%` }}
            >
              {m.label}
            </span>
          ))}
        </div>
        <div className="flex gap-[3px]" role="img" aria-label="Training calendar heatmap, last 26 weeks">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-1 flex-col gap-[3px]">
              {week.map((day) => (
                <div
                  key={day.ts}
                  title={
                    day.inFuture
                      ? undefined
                      : `${formatDate(day.ts)}: ${day.count} session${day.count === 1 ? "" : "s"}`
                  }
                  className="aspect-square w-full rounded-[3px]"
                  style={{
                    background: day.inFuture
                      ? "transparent"
                      : heatColor(day.count, maxCount),
                    // Today gets a locator ring.
                    boxShadow:
                      day.ts === new Date(now).setHours(0, 0, 0, 0)
                        ? "inset 0 0 0 1px rgba(255,255,255,0.9)"
                        : undefined,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-end gap-1.5">
          <span className="hud-label text-muted-foreground">Less</span>
          {[0, 1, 2, 3].map((c) => (
            <span
              key={c}
              className="h-3 w-3 rounded-[3px]"
              style={{ background: heatColor(c, 3) }}
            />
          ))}
          <span className="hud-label text-muted-foreground">More</span>
        </div>
      </div>
    </div>
  );
}

export function HistoryScreen() {
  const { data: prefs } = usePrefs();
  const { data: sessions } = useCompletedSessions();
  const { data: allSets } = useAllSets();
  const { data: lifts } = useLifts();
  const { data: prs } = usePRs();
  const [liftFilter, setLiftFilter] = useState<string | "all">("all");

  const unit = prefs?.unit ?? "lb";
  const liftById = useMemo(() => new Map((lifts ?? []).map((l) => [l.id, l])), [lifts]);

  const dayCounts = useMemo(
    () => trainingDayCounts((sessions ?? []).map((s) => s.startedAt)),
    [sessions],
  );

  const prTimeline = useMemo(() => {
    const list = (prs ?? [])
      .filter((p) => liftFilter === "all" || p.liftId === liftFilter)
      .sort((a, b) => b.achievedAt - a.achievedAt);
    return list.slice(0, 40);
  }, [prs, liftFilter]);

  const sessionRows = useMemo(() => {
    if (!sessions || !allSets || !prefs) return [];
    const setsBySession = new Map<string, typeof allSets>();
    for (const set of allSets) {
      setsBySession.set(set.sessionId, [
        ...(setsBySession.get(set.sessionId) ?? []),
        set,
      ]);
    }
    return [...sessions]
      .sort((a, b) => b.startedAt - a.startedAt)
      .map((session) => {
        const sets = setsBySession.get(session.id) ?? [];
        return {
          session,
          sets,
          volume: totalVolumeKg(sets, liftById, prefs.bodyweightKg),
          liftNames: [...new Set(sets.map((s) => liftById.get(s.liftId)?.name))].filter(
            (n): n is string => Boolean(n),
          ),
        };
      })
      .filter(
        (row) =>
          liftFilter === "all" || row.sets.some((s) => s.liftId === liftFilter),
      )
      .slice(0, 30);
  }, [sessions, allSets, prefs, liftById, liftFilter]);

  return (
    <PageShell>
      <ScreenHeader title="History" eyebrow="Training archive" />

      {/* Lift filter */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          aria-pressed={liftFilter === "all"}
          onClick={() => setLiftFilter("all")}
          className={cn(
            "shrink-0 rounded-full border px-4 py-2.5 text-[13px] font-medium transition-all",
            liftFilter === "all"
              ? "border-forge-cyan/60 bg-forge-cyan/10 text-forge-cyan-hi"
              : "border-forge-cyan/15 text-muted-foreground hover:text-foreground",
          )}
        >
          All lifts
        </button>
        {(lifts ?? []).map((lift) => (
          <button
            key={lift.id}
            type="button"
            aria-pressed={liftFilter === lift.id}
            onClick={() => setLiftFilter(lift.id)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2.5 text-[13px] font-medium transition-all",
              liftFilter === lift.id
                ? "border-forge-cyan/60 bg-forge-cyan/10 text-forge-cyan-hi"
                : "border-forge-cyan/15 text-muted-foreground hover:text-foreground",
            )}
          >
            {lift.name}
          </button>
        ))}
      </div>

      <section aria-label="Training calendar" className="glass-panel mb-4 p-4">
        <h3 className="hud-label mb-3 text-muted-foreground">Training calendar</h3>
        <CalendarHeatmap dayCounts={dayCounts} />
      </section>

      <section aria-label="PR timeline" className="glass-panel mb-4 p-4">
        <h3 className="hud-label mb-3 flex items-center gap-2 text-forge-gold">
          <Trophy className="h-4 w-4" aria-hidden />
          PR timeline
        </h3>
        {prTimeline.length === 0 ? (
          <div className="scanlines rounded-lg p-5 text-center">
            <p className="text-sm text-muted-foreground">
              No records yet. They&apos;re coming — keep showing up.
            </p>
          </div>
        ) : (
          <ol className="relative ml-2 space-y-3 border-l border-forge-gold/25 pl-4">
            {prTimeline.map((pr) => {
              const lift = liftById.get(pr.liftId);
              const value =
                pr.type === "reps"
                  ? `${pr.value} reps @ ${formatDisplayWeight(pr.atWeightKg ?? 0, unit)} ${unit}`
                  : `${formatDisplayWeight(pr.value, unit)} ${unit}`;
              const delta =
                pr.previousValue === null
                  ? "first record"
                  : pr.type === "reps"
                    ? `prev ${pr.previousValue}`
                    : `+${formatDisplayWeight(Math.max(0, pr.value - pr.previousValue), unit)} ${unit}`;
              return (
                <li key={pr.id} className="relative">
                  <span
                    aria-hidden
                    className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-forge-gold glow-gold"
                  />
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="hud-label text-forge-gold">
                      {PR_TYPE_LABEL[pr.type]}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {lift?.name ?? "Unknown lift"}
                    </span>
                    <span className="tabular text-sm text-foreground">
                      {value}
                    </span>
                    <span className="text-xs text-muted-foreground">({delta})</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(pr.achievedAt)}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section aria-label="Session archive">
        <h3 className="hud-label mb-2 text-muted-foreground">Sessions</h3>
        {sessionRows.length === 0 ? (
          <div className="glass-panel scanlines p-6 text-center">
            <div className="hud-label text-forge-cyan-hi">Archive empty</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Completed sessions will assemble here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sessionRows.map(({ session, sets, volume, liftNames }) => (
              <li key={session.id}>
                <Link
                  href={`/summary?id=${session.id}`}
                  className="glass-panel flex items-center justify-between gap-3 p-4 transition-colors hover:border-forge-cyan/35"
                >
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {formatShortDate(session.startedAt)}
                      {session.isDemo ? (
                        <span className="hud-label ml-2 rounded border border-forge-magenta/40 px-1 py-0.5 text-forge-magenta">
                          Demo
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {liftNames.join(" · ")}
                    </div>
                  </div>
                  <div className="tabular text-right text-xs text-muted-foreground">
                    <div>
                      {formatDuration(
                        (session.endedAt ?? session.startedAt) - session.startedAt,
                      )}
                    </div>
                    <div className="text-foreground">
                      {formatVolume(volume, unit)} {unit}
                    </div>
                    <div>{sets.length} sets</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
