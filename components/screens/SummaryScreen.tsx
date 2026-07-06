"use client";

import { Info, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageShell, ScreenHeader } from "@/components/hud/PageShell";
import { LiftViewport } from "@/components/three/SceneViewport";
import { estimateE1RM } from "@/lib/analytics/e1rm";
import { totalLoadKg, totalVolumeKg } from "@/lib/analytics/volume";
import { formatDate, formatDisplayWeight, formatDuration, formatVolume } from "@/lib/format";
import { solvePlates } from "@/lib/plates/solve";
import type { Lift, PR, SetEntry } from "@/lib/types";
import { displayWeight } from "@/lib/units";
import {
  useAllSets,
  useCompletedSessions,
  useDiscardSession,
  useLifts,
  usePRs,
  usePrefs,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

const PR_TYPE_LABEL: Record<PR["type"], string> = {
  weight: "Weight PR",
  reps: "Rep PR",
  e1rm: "e1RM PR",
  volume: "Volume PR",
};

function TopSetRow({
  lift,
  sets,
  bodyweightKg,
  unit,
}: {
  lift: Lift;
  sets: SetEntry[];
  bodyweightKg: number | null;
  unit: "lb" | "kg";
}) {
  const [showBoth, setShowBoth] = useState(false);
  const top = useMemo(() => {
    let best: { set: SetEntry; load: number } | null = null;
    for (const set of sets) {
      const load = totalLoadKg(set, lift, bodyweightKg);
      if (!best || load > best.load) best = { set, load };
    }
    return best;
  }, [sets, lift, bodyweightKg]);

  if (!top) return null;
  const est = estimateE1RM(top.load, top.set.reps);
  const weightLabel = lift.isBodyweight
    ? top.set.weightKg === 0
      ? "BW"
      : `BW${top.set.weightKg > 0 ? "+" : "−"}${formatDisplayWeight(Math.abs(top.set.weightKg), unit)}`
    : formatDisplayWeight(top.set.weightKg, unit);

  return (
    <li className="flex items-center justify-between gap-3 border-b border-forge-cyan/10 py-3 last:border-b-0">
      <div>
        <div className="text-sm font-semibold text-foreground">{lift.name}</div>
        <div className="tabular text-sm text-muted-foreground">
          {weightLabel} × {top.set.reps}
          {top.set.rpe !== null ? (
            <span className="text-forge-magenta"> @ {top.set.rpe}</span>
          ) : null}
          <span className="ml-2 text-xs">{sets.length} sets</span>
        </div>
      </div>
      {est ? (
        <button
          type="button"
          onClick={() => setShowBoth((v) => !v)}
          aria-expanded={showBoth}
          aria-label={`Estimated one rep max for ${lift.name}: ${formatDisplayWeight(est.epley, unit)} ${unit} (Epley). Toggle to compare formulas.`}
          className={cn(
            "tabular flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
            est.lowConfidence
              ? "border-amber-500/40 text-amber-300"
              : "border-white/15 text-foreground hover:border-white/35",
          )}
        >
          {showBoth ? (
            <span>
              EPLEY {formatDisplayWeight(est.epley, unit)} · BRZ{" "}
              {formatDisplayWeight(est.brzycki, unit)}
            </span>
          ) : (
            <span>e1RM {formatDisplayWeight(est.epley, unit)}</span>
          )}
          {est.lowConfidence ? (
            <span
              title="Estimated from a set above 12 reps — low confidence"
              className="h-1.5 w-1.5 rounded-full bg-amber-400"
            />
          ) : (
            <Info className="h-3 w-3 opacity-60" aria-hidden />
          )}
        </button>
      ) : null}
    </li>
  );
}

export function SummaryScreen({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { data: prefs } = usePrefs();
  const { data: sessions } = useCompletedSessions();
  const { data: allSets } = useAllSets();
  const { data: lifts } = useLifts();
  const { data: allPRs } = usePRs();
  const discard = useDiscardSession();
  const [prToken, setPrToken] = useState(0);

  const session = sessions?.find((s) => s.id === sessionId);
  const sets = useMemo(
    () =>
      (allSets ?? [])
        .filter((s) => s.sessionId === sessionId)
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [allSets, sessionId],
  );
  const sessionPRs = useMemo(
    () => (allPRs ?? []).filter((p) => p.sessionId === sessionId),
    [allPRs, sessionId],
  );
  const liftById = useMemo(
    () => new Map((lifts ?? []).map((l) => [l.id, l])),
    [lifts],
  );

  const byLift = useMemo(() => {
    const map = new Map<string, SetEntry[]>();
    for (const set of sets) {
      map.set(set.liftId, [...(map.get(set.liftId) ?? []), set]);
    }
    return map;
  }, [sets]);

  // The celebration scene shows the biggest PR's set, loaded exactly.
  const heroPR = useMemo(() => {
    const order: PR["type"][] = ["weight", "e1rm", "reps", "volume"];
    return [...sessionPRs].sort(
      (a, b) => order.indexOf(a.type) - order.indexOf(b.type),
    )[0];
  }, [sessionPRs]);

  const heroSet = heroPR
    ? sets.find((s) => s.id === heroPR.setEntryId)
    : sets[sets.length - 1];
  const heroLift = heroSet ? liftById.get(heroSet.liftId) : undefined;

  // Fire the celebration once, after the scene mounts.
  useEffect(() => {
    if (!heroPR) return;
    const timer = setTimeout(() => setPrToken(1), 900);
    return () => clearTimeout(timer);
  }, [heroPR]);

  if (!prefs || !sessions || !allSets || !lifts) {
    return (
      <PageShell>
        <div className="glass-panel scanlines flex h-64 items-center justify-center">
          <span className="hud-label animate-live-dot text-muted-foreground">
            Loading debrief
          </span>
        </div>
      </PageShell>
    );
  }

  if (!session) {
    return (
      <PageShell>
        <ScreenHeader title="Session Debrief" eyebrow="Archive" />
        <div className="glass-panel scanlines p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Session not found in the archive.
          </p>
          <Link href="/" className="mt-3 inline-block text-sm text-foreground underline">
            Return to Nexus
          </Link>
        </div>
      </PageShell>
    );
  }

  const unit = prefs.unit;
  const volume = totalVolumeKg(sets, liftById, prefs.bodyweightKg);
  const duration = (session.endedAt ?? session.startedAt) - session.startedAt;
  const heroWeight = heroSet ? displayWeight(heroSet.weightKg, unit) : 0;

  return (
    <PageShell>
      <ScreenHeader
        title="Session Debrief"
        eyebrow={formatDate(session.startedAt)}
        right={
          <Link
            href="/"
            aria-label="Close debrief"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-forge-cyan/15 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden />
          </Link>
        }
      />

      {heroLift && heroSet ? (
        <LiftViewport
          className="mb-4"
          kind={heroLift.scene}
          solution={solvePlates(
            heroLift.usesBarbell ? heroWeight : unit === "kg" ? 20 : 45,
            unit,
          )}
          e1rmFraction={heroPR ? 1 : 0.75}
          animateToken={0}
          prToken={prToken}
          reps={heroSet.reps}
          addedWeightKg={heroLift.isBodyweight ? heroSet.weightKg : 0}
          displayLoad={heroWeight}
          gold={Boolean(heroPR)}
          label={
            heroPR
              ? `PR · ${heroLift.name} ${formatDisplayWeight(heroPR.type === "reps" ? heroSet.weightKg : heroPR.value, unit)} ${unit}`
              : `${heroLift.name} · Top set`
          }
        />
      ) : null}

      {sessionPRs.length > 0 ? (
        <section
          aria-label="Personal records this session"
          className="glass-panel glass-panel-gold mb-4 p-4"
        >
          <div className="hud-label mb-2 flex items-center gap-2 text-forge-gold">
            <Trophy className="h-4 w-4" aria-hidden />
            {sessionPRs.length === 1 ? "New record" : `${sessionPRs.length} new records`}
          </div>
          <ul className="space-y-1.5">
            {sessionPRs.map((pr) => {
              const lift = liftById.get(pr.liftId);
              const value =
                pr.type === "reps"
                  ? `${pr.value} reps @ ${formatDisplayWeight(pr.atWeightKg ?? 0, unit)} ${unit}`
                  : `${formatDisplayWeight(pr.value, unit)} ${unit}`;
              const delta =
                pr.previousValue !== null && pr.type !== "reps"
                  ? ` (+${formatDisplayWeight(Math.max(0, pr.value - pr.previousValue), unit)})`
                  : pr.previousValue !== null
                    ? ` (prev ${pr.previousValue})`
                    : " (first)";
              return (
                <li key={pr.id} className="text-sm text-foreground">
                  <span className="font-semibold text-forge-gold">
                    {PR_TYPE_LABEL[pr.type]}
                  </span>{" "}
                  — {lift?.name ?? "Unknown lift"} {value}
                  <span className="text-muted-foreground">{delta}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3">
        {[
          { label: "Duration", value: formatDuration(duration) },
          { label: `Volume (${unit})`, value: formatVolume(volume, unit) },
          { label: "Sets", value: String(sets.length) },
          { label: "Lifts", value: String(byLift.size) },
        ].map((stat) => (
          <section key={stat.label} aria-label={`${stat.label}: ${stat.value}`} className="glass-panel p-4">
            <div className="hud-label text-muted-foreground">{stat.label}</div>
            <div className="tabular mt-1 text-3xl font-bold text-foreground">
              {stat.value}
            </div>
          </section>
        ))}
      </div>

      <section aria-label="Top sets by lift" className="glass-panel mb-4 px-4 py-2">
        <div className="hud-label pt-2 text-muted-foreground">Top sets</div>
        <ul>
          {[...byLift.entries()].map(([liftId, liftSets]) => {
            const lift = liftById.get(liftId);
            if (!lift) return null;
            return (
              <TopSetRow
                key={liftId}
                lift={lift}
                sets={liftSets}
                bodyweightKg={prefs.bodyweightKg}
                unit={unit}
              />
            );
          })}
        </ul>
      </section>

      <Link
        href="/"
        className="mb-2 flex min-h-14 w-full items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
      >
        Done
      </Link>
      <button
        type="button"
        onClick={async () => {
          await discard.mutateAsync(sessionId);
          router.push("/");
        }}
        className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-destructive/30 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
      >
        Discard Session
      </button>
    </PageShell>
  );
}
