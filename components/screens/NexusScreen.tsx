"use client";

import { ChevronRight, Flame, Link2, Settings } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { NexusHero } from "@/components/hud/NexusHero";
import { FloatingPaths } from "@/components/ui/background-paths";
import { PageShell } from "@/components/hud/PageShell";
import { computeStreaks } from "@/lib/analytics/streak";
import { useMediaQuery, useMountedNow } from "@/lib/hooks";
import { totalVolumeKg } from "@/lib/analytics/volume";
import { daysAgoLabel, formatDuration, formatShortDate, formatVolume } from "@/lib/format";
import {
  useActiveSession,
  useAllSets,
  useCompletedSessions,
  useDemoSeeded,
  useLifts,
  usePrefs,
} from "@/lib/queries";

export function NexusScreen() {
  const { data: prefs } = usePrefs();
  const { data: sessions } = useCompletedSessions();
  const { data: allSets } = useAllSets();
  const { data: lifts } = useLifts();
  const { data: activeSession } = useActiveSession();
  const { data: demoSeeded } = useDemoSeeded();

  const now = useMountedNow();
  const systemReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const reducedMotion = systemReducedMotion || Boolean(prefs?.reducedMotion);

  const streaks = useMemo(() => {
    if (!sessions || !prefs) return { weekStreak: 0, dayChain: 0 };
    return computeStreaks(
      sessions.map((s) => s.startedAt),
      prefs.weeklyTarget,
      prefs.weekStartsOn,
      now,
    );
  }, [sessions, prefs, now]);

  const lastSession = useMemo(() => {
    if (!sessions || sessions.length === 0 || !allSets || !lifts || !prefs) {
      return null;
    }
    const last = [...sessions].sort((a, b) => b.startedAt - a.startedAt)[0];
    const sets = allSets.filter((s) => s.sessionId === last.id);
    const liftById = new Map(lifts.map((l) => [l.id, l]));
    const volume = totalVolumeKg(sets, liftById, prefs.bodyweightKg);
    const liftNames = [...new Set(sets.map((s) => s.liftId))]
      .map((id) => liftById.get(id)?.name)
      .filter((n): n is string => Boolean(n));
    return { session: last, volume, liftNames, setCount: sets.length };
  }, [sessions, allSets, lifts, prefs]);

  /** Least-recently-trained core barbell lift → next directive. */
  const nextDirective = useMemo(() => {
    if (!lifts || !allSets) return null;
    const lastTrained = new Map<string, number>();
    for (const set of allSets) {
      lastTrained.set(
        set.liftId,
        Math.max(lastTrained.get(set.liftId) ?? 0, set.createdAt),
      );
    }
    const core = lifts.filter((l) => !l.isCustom);
    if (core.length === 0) return null;
    const ranked = [...core].sort(
      (a, b) => (lastTrained.get(a.id) ?? 0) - (lastTrained.get(b.id) ?? 0),
    );
    const pick = ranked[0];
    const last = lastTrained.get(pick.id);
    return { lift: pick, lastTrained: last ?? null };
  }, [lifts, allSets]);

  return (
    <PageShell>
      {/* Ambient flowing-paths background (21st.dev), behind everything. */}
      {!reducedMotion ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-75 [mask-image:radial-gradient(115%_85%_at_50%_40%,transparent_22%,black_65%)]"
        >
          {/* Two full-artwork bands (native 696:316 aspect — no cropping),
              each carrying the full ± weave like the stock demo: one
              sweeping the top, one mirrored across the bottom. */}
          <div className="absolute left-[-30%] top-[-14%] aspect-[696/316] w-[160%]">
            <FloatingPaths position={1} />
            <FloatingPaths position={-1} />
          </div>
          <div className="absolute bottom-[-14%] left-[-30%] aspect-[696/316] w-[160%] -scale-y-100">
            <FloatingPaths position={1} />
            <FloatingPaths position={-1} />
          </div>
        </div>
      ) : null}
      <div className="relative z-10">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Liftora
          </h1>
        </div>
        <Link
          href="/settings"
          aria-label="Settings"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-forge-cyan/15 text-muted-foreground transition-colors hover:border-forge-cyan/40 hover:text-foreground"
        >
          <Settings className="h-5 w-5" aria-hidden />
        </Link>
      </header>

      {demoSeeded ? (
        <div className="mb-3 flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
          <span className="rounded-md bg-forge-panel-hi px-1.5 py-0.5 font-medium text-foreground">
            Demo
          </span>
          <span className="truncate">sample history loaded</span>
          <Link
            href="/settings"
            className="shrink-0 underline underline-offset-2 hover:text-foreground"
          >
            Clear
          </Link>
        </div>
      ) : null}

      {/* Interactive hero (21st.dev Spline + Spotlight), full width. */}
      <NexusHero />

      <div className="md:grid md:grid-cols-2 md:items-start md:gap-x-6">
      <div className="md:col-start-1">
      {/* Streaks: gold is earned here and nowhere else. */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <section
          aria-label={`Week streak: ${streaks.weekStreak} weeks at target`}
          className="glass-panel glass-panel-gold p-4"
        >
          <div className="hud-label flex items-center gap-1.5 text-forge-gold">
            <Flame className="h-3.5 w-3.5" aria-hidden />
            Week streak
          </div>
          <div className="tabular mt-1 text-4xl font-bold text-forge-gold">
            {streaks.weekStreak}
          </div>
          <div className="text-xs text-muted-foreground">weeks at target</div>
        </section>
        <section
          aria-label={`Day chain: ${streaks.dayChain} consecutive days`}
          className="glass-panel p-4"
        >
          <div className="hud-label flex items-center gap-1.5 text-muted-foreground">
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            Day chain
          </div>
          <div className="tabular mt-1 text-4xl font-bold text-foreground">
            {streaks.dayChain}
          </div>
          <div className="text-xs text-muted-foreground">consecutive days</div>
        </section>
      </div>

      <Link
        href="/log"
        className="group mb-4 flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
      >
        {activeSession ? "Resume Session" : "Start Session"}
        <ChevronRight
          className="h-5 w-5 transition-transform group-hover:translate-x-1"
          aria-hidden
        />
      </Link>
      </div>

      <div className="md:col-start-2">
      {lastSession ? (
        <section aria-label="Last session" className="glass-panel mb-4 p-4">
          <div className="hud-label mb-2 text-muted-foreground">Last session</div>
          <div className="flex items-baseline justify-between">
            <span className="text-base font-medium text-foreground">
              {formatShortDate(lastSession.session.startedAt)}
            </span>
            <span className="text-xs text-muted-foreground">
              {daysAgoLabel(lastSession.session.startedAt)}
            </span>
          </div>
          <div className="tabular mt-2 flex gap-5 text-sm text-foreground">
            <span>
              {formatDuration(
                (lastSession.session.endedAt ?? lastSession.session.startedAt) -
                  lastSession.session.startedAt,
              )}
              <span className="ml-1 text-xs text-muted-foreground">time</span>
            </span>
            <span>
              {prefs ? formatVolume(lastSession.volume, prefs.unit) : "—"}
              <span className="ml-1 text-xs text-muted-foreground">
                {prefs?.unit ?? ""} vol
              </span>
            </span>
            <span>
              {lastSession.setCount}
              <span className="ml-1 text-xs text-muted-foreground">sets</span>
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {lastSession.liftNames.map((name) => (
              <span
                key={name}
                className="hud-label rounded-md bg-forge-panel-hi px-2 py-1 text-foreground"
              >
                {name}
              </span>
            ))}
          </div>
        </section>
      ) : (
        <section
          aria-label="No sessions yet"
          className="glass-panel scanlines mb-4 p-6 text-center"
        >
          <div className="hud-label text-muted-foreground">No sessions yet</div>
          <p className="mt-2 text-sm text-muted-foreground">
            No sessions in the archive. Start your first session to light the
            forge.
          </p>
        </section>
      )}

      {nextDirective ? (
        <Link
          href="/log"
          className="glass-panel flex items-center justify-between p-4 transition-colors hover:border-forge-cyan/35"
        >
          <div>
            <div className="hud-label text-muted-foreground">Next directive</div>
            <div className="mt-1 text-sm text-foreground">
              Least recently trained:{" "}
              <span className="font-semibold text-foreground">
                {nextDirective.lift.name}
              </span>
              {nextDirective.lastTrained ? (
                <span className="text-muted-foreground">
                  {" "}
                  — {daysAgoLabel(nextDirective.lastTrained)}
                </span>
              ) : (
                <span className="text-muted-foreground"> — never trained</span>
              )}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
        </Link>
      ) : null}
      </div>
      </div>
      </div>
    </PageShell>
  );
}
