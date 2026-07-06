"use client";

import { Reorder, useDragControls } from "framer-motion";
import { GripVertical, Plus, Repeat2, Trash2, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/hud/PageShell";
import { PRFlourish } from "@/components/hud/PRFlourish";
import { RestTimer } from "@/components/hud/RestTimer";
import { SessionClock } from "@/components/hud/SessionClock";
import { Stepper } from "@/components/hud/Stepper";
import { LiftViewport } from "@/components/three/SceneViewport";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { estimateE1RM } from "@/lib/analytics/e1rm";
import { totalLoadKg } from "@/lib/analytics/volume";
import { describeLoadout, solvePlates } from "@/lib/plates/solve";
import type { Lift, SetEntry } from "@/lib/types";
import { displayWeight, formatWeight, toKg } from "@/lib/units";
import {
  useActiveSession,
  useAddLift,
  useDeleteSet,
  useEndSession,
  useDiscardSession,
  useLifts,
  usePrefs,
  useReorderSets,
  useSaveSet,
  useSessionSets,
  useStartSession,
  useUpdatePrefs,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

const PR_LABELS: Record<string, string> = {
  weight: "Weight PR",
  reps: "Rep PR",
  e1rm: "e1RM PR",
  volume: "Volume PR",
};

function SetRow({
  set,
  lift,
  unit,
  onDelete,
  isLatest,
}: {
  set: SetEntry;
  lift: Lift;
  unit: "lb" | "kg";
  onDelete: () => void;
  isLatest: boolean;
}) {
  const controls = useDragControls();
  const weight = displayWeight(set.weightKg, unit);
  const weightLabel = lift.isBodyweight
    ? set.weightKg === 0
      ? "BW"
      : `BW${weight >= 0 ? "+" : "−"}${formatWeight(Math.abs(weight))}`
    : formatWeight(weight);

  return (
    <Reorder.Item
      value={set.id}
      dragListener={false}
      dragControls={controls}
      className={cn(
        "glass-panel flex items-center gap-3 px-3 py-2.5",
        isLatest && "border-forge-cyan/40",
      )}
    >
      <span className="hud-label w-12 shrink-0 text-muted-foreground">
        Set {set.orderIndex + 1}
      </span>
      <span className="tabular text-sm text-foreground">
        {weightLabel} × {set.reps}
        {set.rpe !== null ? (
          <span className="text-forge-magenta"> @ {set.rpe}</span>
        ) : null}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          aria-label={`Delete set ${set.orderIndex + 1}`}
          onClick={onDelete}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Reorder set ${set.orderIndex + 1}`}
          className="flex h-9 w-9 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground active:cursor-grabbing"
          onPointerDown={(e) => controls.start(e)}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </Reorder.Item>
  );
}

export function LoggerScreen() {
  const router = useRouter();
  const { data: prefs } = usePrefs();
  const { data: lifts } = useLifts();
  const { data: activeSession, isLoading: sessionLoading } = useActiveSession();
  const startSession = useStartSession();
  const endSession = useEndSession();
  const discardSession = useDiscardSession();
  const saveSet = useSaveSet();
  const updatePrefs = useUpdatePrefs();
  const addLift = useAddLift();
  const { data: sessionSets } = useSessionSets(activeSession?.id);
  const deleteSet = useDeleteSet(activeSession?.id);
  const reorder = useReorderSets(activeSession?.id ?? "");

  const unit = prefs?.unit ?? "lb";

  const [selectedLiftId, setSelectedLiftId] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState<number | null>(null);
  const [reps, setReps] = useState(5);
  const [rpe, setRpe] = useState<number>(8);
  const [animateToken, setAnimateToken] = useState(0);
  const [prToken, setPrToken] = useState(0);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showBodyweightDialog, setShowBodyweightDialog] = useState(false);
  const [bodyweightInput, setBodyweightInput] = useState("");
  const [showNewLift, setShowNewLift] = useState(false);
  const [newLiftName, setNewLiftName] = useState("");
  const [newLiftBarbell, setNewLiftBarbell] = useState(true);
  const [newLiftBodyweight, setNewLiftBodyweight] = useState(false);
  const commitRef = useRef<HTMLButtonElement>(null);

  // Auto-start (or resume) the session on entry — Quick Log is one tap.
  useEffect(() => {
    if (!sessionLoading && !activeSession && !startSession.isPending) {
      startSession.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, activeSession]);

  const selectedLift = useMemo(
    () => lifts?.find((l) => l.id === selectedLiftId) ?? lifts?.[0] ?? null,
    [lifts, selectedLiftId],
  );

  const liftSets = useMemo(
    () =>
      (sessionSets ?? [])
        .filter((s) => s.liftId === selectedLift?.id)
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [sessionSets, selectedLift],
  );

  // Historical best e1RM for the glow scale + last set for repeat.
  const [bestE1rmKg, setBestE1rmKg] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!selectedLift || !prefs) return;
    void import("@/lib/db/repo").then(async ({ getSetsForLift }) => {
      const sets = await getSetsForLift(selectedLift.id);
      let best: number | null = null;
      for (const s of sets) {
        const load = totalLoadKg(s, selectedLift, prefs.bodyweightKg);
        const est = estimateE1RM(load, s.reps);
        if (est && (best === null || est.epley > best)) best = est.epley;
      }
      if (!cancelled) setBestE1rmKg(best);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedLift, prefs, sessionSets]);

  // Default weight when switching lifts: last set of that lift, else sensible bar.
  useEffect(() => {
    if (!selectedLift || !prefs) return;
    let cancelled = false;
    void import("@/lib/db/repo").then(async ({ getSetsForLift }) => {
      const sets = await getSetsForLift(selectedLift.id);
      if (cancelled) return;
      const last = sets.sort((a, b) => b.createdAt - a.createdAt)[0];
      if (last) {
        setWeightInput(displayWeight(last.weightKg, prefs.unit));
        setReps(last.reps);
        setRpe(last.rpe ?? 0);
      } else {
        setWeightInput(
          selectedLift.isBodyweight ? 0 : prefs.unit === "kg" ? 60 : 135,
        );
        setReps(5);
        setRpe(8);
      }
      // Bodyweight prompt: needed once for honest volume math.
      if (selectedLift.isBodyweight && prefs.bodyweightKg === null) {
        setShowBodyweightDialog(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedLift, prefs]);

  const weight = weightInput ?? (selectedLift?.isBodyweight ? 0 : unit === "kg" ? 60 : 135);
  const weightKg = toKg(weight, unit);

  const solution = useMemo(() => {
    if (!selectedLift?.usesBarbell) return null;
    return solvePlates(weight, unit);
  }, [selectedLift, weight, unit]);

  const currentLoadKg = selectedLift
    ? totalLoadKg({ weightKg }, selectedLift, prefs?.bodyweightKg ?? null)
    : weightKg;
  const e1rmFraction =
    bestE1rmKg && bestE1rmKg > 0 ? currentLoadKg / bestE1rmKg : null;

  const handleCommit = useCallback(
    async (override?: { weightKg: number; reps: number; rpe: number | null }) => {
      if (!activeSession || !selectedLift || !prefs) return;
      const payload = override ?? {
        weightKg,
        reps,
        rpe: rpe > 0 ? rpe : null,
      };
      try {
        const result = await saveSet.mutateAsync({
          sessionId: activeSession.id,
          liftId: selectedLift.id,
          ...payload,
        });
        setAnimateToken((t) => t + 1);
        commitRef.current?.classList.remove("animate-commit-pulse");
        // Force reflow so the pulse can replay.
        void commitRef.current?.offsetWidth;
        commitRef.current?.classList.add("animate-commit-pulse");
        if (result.prs.length > 0) {
          setPrToken((t) => t + 1);
          for (const pr of result.prs) {
            toast(
              <span className="font-semibold text-forge-gold">
                <Trophy className="mr-2 inline h-4 w-4" aria-hidden />
                {PR_LABELS[pr.type]} — {selectedLift.name}
              </span>,
              { duration: 4000 },
            );
          }
        }
        setRestEndsAt(Date.now() + (prefs.restTimerDefault ?? 150) * 1000);
      } catch {
        toast.error("Set failed to save — try again");
      }
    },
    [activeSession, selectedLift, prefs, weightKg, reps, rpe, saveSet],
  );

  const handleRepeatLast = useCallback(() => {
    const last = liftSets[liftSets.length - 1];
    if (!last) return;
    void handleCommit({ weightKg: last.weightKg, reps: last.reps, rpe: last.rpe });
  }, [liftSets, handleCommit]);

  const handleEnd = useCallback(async () => {
    if (!activeSession) return;
    const hasSets = (sessionSets?.length ?? 0) > 0;
    if (!hasSets) {
      await discardSession.mutateAsync(activeSession.id);
      router.push("/");
      return;
    }
    const ended = await endSession.mutateAsync({ sessionId: activeSession.id });
    router.push(`/summary?id=${ended.id}`);
  }, [activeSession, sessionSets, endSession, discardSession, router]);

  const increment = selectedLift?.defaultIncrement ?? (unit === "kg" ? 2.5 : 5);

  if (!prefs || !lifts || !selectedLift || sessionLoading || !activeSession) {
    return (
      <PageShell>
        <div className="glass-panel scanlines flex h-64 items-center justify-center">
          <span className="hud-label animate-live-dot text-muted-foreground">
            Starting session
          </span>
        </div>
      </PageShell>
    );
  }

  const loadoutLabel = solution ? describeLoadout(solution) : undefined;
  const approximate =
    solution?.kind === "loaded" && solution.isApproximate
      ? `Nearest loadable: ${formatWeight(solution.achievedTotal)}`
      : solution?.kind === "below-bar"
        ? `Below ${solution.barWeight} ${unit} bar`
        : undefined;

  return (
    <PageShell>
      <PRFlourish trigger={prToken} />
      <header className="mb-4 flex items-center justify-between gap-3">
        <SessionClock startedAt={activeSession.startedAt} />
        <button
          type="button"
          onClick={() => setShowEndDialog(true)}
          className="hud-label rounded-full border border-forge-cyan/30 px-4 py-2.5 text-forge-cyan-hi transition-colors hover:border-forge-cyan/60 hover:bg-forge-cyan/10"
        >
          End
        </button>
      </header>

      {/* Desktop command-center: scene + archive left, entry console right. */}
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] md:items-start md:gap-x-6">
      <div className="md:col-start-1 md:row-start-1">
      <LiftViewport
        className="mb-4"
        kind={selectedLift.scene}
        solution={
          solution ?? solvePlates(unit === "kg" ? 20 : 45, unit) /* rig scenes ignore it */
        }
        e1rmFraction={e1rmFraction}
        animateToken={animateToken}
        prToken={prToken}
        reps={reps}
        addedWeightKg={selectedLift.isBodyweight ? weightKg : 0}
        displayLoad={weight}
        label={`${selectedLift.name} · ${
          selectedLift.isBodyweight
            ? weight === 0
              ? "Bodyweight"
              : `BW ${weight > 0 ? "+" : "−"} ${formatWeight(Math.abs(weight))} ${unit}`
            : `${formatWeight(weight)} ${unit}`
        }`}
        sublabel={
          approximate ??
          loadoutLabel ??
          (selectedLift.scene === "dumbbell"
            ? "Per dumbbell"
            : selectedLift.scene === "latpulldown"
              ? "Stack pin"
              : undefined)
        }
      />
      </div>

      <div className="md:sticky md:top-6 md:col-start-2 md:row-span-2 md:row-start-1">
      {/* Lift selector */}
      <div
        role="tablist"
        aria-label="Select lift"
        className="mb-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {lifts.map((lift) => {
          const active = lift.id === selectedLift.id;
          return (
            <button
              key={lift.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedLiftId(lift.id)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2.5 text-[13px] font-medium transition-all",
                active
                  ? "border-forge-cyan/60 bg-forge-cyan/10 text-forge-cyan-hi glow-cyan"
                  : "border-forge-cyan/15 text-muted-foreground hover:border-forge-cyan/35 hover:text-foreground",
              )}
            >
              {lift.name}
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Add custom lift"
          onClick={() => setShowNewLift(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-forge-cyan/15 text-muted-foreground transition-colors hover:border-forge-cyan/35 hover:text-foreground"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Entry console */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Stepper
          inputId="weight-input"
          label={selectedLift.isBodyweight ? (weight >= 0 ? "Added" : "Assist") : "Weight"}
          value={weight}
          onChange={setWeightInput}
          step={increment}
          min={selectedLift.isBodyweight ? -200 : 0}
          max={unit === "kg" ? 500 : 1100}
          unit={unit.toUpperCase()}
        />
        <Stepper
          inputId="reps-input"
          label="Reps"
          value={reps}
          onChange={(v) => setReps(Math.round(v))}
          step={1}
          min={1}
          max={50}
        />
        <Stepper
          inputId="rpe-input"
          label="RPE"
          value={rpe}
          onChange={setRpe}
          step={0.5}
          min={0}
          max={10}
          accent="magenta"
          format={(v) => (v === 0 ? "—" : String(v))}
        />
      </div>
      <p className="hud-label mb-3 text-center text-muted-foreground">
        RPE 0 = not rated
        {selectedLift.isBodyweight
          ? " · negative weight = band/machine assistance"
          : ""}
      </p>

      <button
        ref={commitRef}
        type="button"
        onClick={() => void handleCommit()}
        disabled={saveSet.isPending}
        className="mb-2 flex min-h-16 w-full items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {saveSet.isPending ? "Logging…" : "Log Set"}
      </button>
      <button
        type="button"
        onClick={handleRepeatLast}
        disabled={liftSets.length === 0 || saveSet.isPending}
        className="mb-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-secondary text-sm font-medium text-foreground transition-colors hover:bg-forge-panel-hi disabled:opacity-40"
      >
        <Repeat2 className="h-4 w-4" aria-hidden />
        Repeat Last Set
      </button>

      <div className="mb-4">
        <RestTimer
          endsAt={restEndsAt}
          durationSeconds={prefs.restTimerDefault}
          onDismiss={() => setRestEndsAt(null)}
          onRestart={() =>
            setRestEndsAt(Date.now() + prefs.restTimerDefault * 1000)
          }
        />
      </div>
      </div>

      {/* Per-lift set list with drag reorder */}
      <section
        aria-label={`${selectedLift.name} sets this session`}
        className="md:col-start-1 md:row-start-2"
      >
        <div className="hud-label mb-2 flex items-baseline justify-between text-muted-foreground">
          <span>
            {selectedLift.name} — {liftSets.length}{" "}
            {liftSets.length === 1 ? "set" : "sets"}
          </span>
          <span>session total: {sessionSets?.length ?? 0}</span>
        </div>
        {liftSets.length === 0 ? (
          <div className="glass-panel scanlines p-5 text-center">
            <p className="text-sm text-muted-foreground">
              No sets committed for this lift yet. The bar is loaded — send it.
            </p>
          </div>
        ) : (
          <Reorder.Group
            axis="y"
            values={liftSets.map((s) => s.id)}
            onReorder={(ids: string[]) => reorder.mutate(ids)}
            className="flex flex-col gap-2"
          >
            {liftSets.map((set, i) => (
              <SetRow
                key={set.id}
                set={set}
                lift={selectedLift}
                unit={unit}
                isLatest={i === liftSets.length - 1}
                onDelete={() => deleteSet.mutate(set.id)}
              />
            ))}
          </Reorder.Group>
        )}
      </section>
      </div>

      {/* End-session dialog */}
      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent className="glass-panel border-forge-cyan/25">
          <DialogHeader>
            <DialogTitle className="font-semibold">
              End session?
            </DialogTitle>
            <DialogDescription>
              {(sessionSets?.length ?? 0) > 0
                ? `${sessionSets?.length} sets will be committed to the archive.`
                : "No sets were logged — the session will be discarded."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setShowEndDialog(false)}
              className="min-h-11 rounded-xl border border-forge-cyan/25 px-4 text-sm text-foreground"
            >
              Keep training
            </button>
            <button
              type="button"
              onClick={() => void handleEnd()}
              className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              {(sessionSets?.length ?? 0) > 0 ? "End & review" : "Discard"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-time bodyweight prompt */}
      <Dialog open={showBodyweightDialog} onOpenChange={setShowBodyweightDialog}>
        <DialogContent className="glass-panel border-forge-cyan/25">
          <DialogHeader>
            <DialogTitle className="font-semibold">
              Set your bodyweight
            </DialogTitle>
            <DialogDescription>
              Bodyweight lifts count your bodyweight plus added load toward
              volume and PRs. Stored locally; update anytime in Settings.
            </DialogDescription>
          </DialogHeader>
          <label htmlFor="bw-input" className="hud-label text-muted-foreground">
            Bodyweight ({unit})
          </label>
          <input
            id="bw-input"
            type="number"
            inputMode="decimal"
            value={bodyweightInput}
            onChange={(e) => setBodyweightInput(e.target.value)}
            className="tabular min-h-12 rounded-xl border border-forge-cyan/25 bg-forge-panel px-3 text-xl text-foreground"
          />
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setShowBodyweightDialog(false)}
              className="min-h-11 rounded-xl border border-forge-cyan/25 px-4 text-sm"
            >
              Later
            </button>
            <button
              type="button"
              disabled={!Number.isFinite(Number(bodyweightInput)) || Number(bodyweightInput) <= 0}
              onClick={() => {
                updatePrefs.mutate({
                  bodyweightKg: toKg(Number(bodyweightInput), unit),
                });
                setShowBodyweightDialog(false);
              }}
              className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New custom lift */}
      <Dialog open={showNewLift} onOpenChange={setShowNewLift}>
        <DialogContent className="glass-panel border-forge-cyan/25">
          <DialogHeader>
            <DialogTitle className="font-semibold">
              New custom lift
            </DialogTitle>
            <DialogDescription>
              Barbell lifts get the full plate-loading scene.
            </DialogDescription>
          </DialogHeader>
          <label htmlFor="lift-name" className="hud-label text-muted-foreground">
            Name
          </label>
          <input
            id="lift-name"
            value={newLiftName}
            onChange={(e) => setNewLiftName(e.target.value)}
            className="min-h-12 rounded-xl border border-forge-cyan/25 bg-forge-panel px-3 text-foreground"
            placeholder="Front Squat"
          />
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={newLiftBarbell}
                onChange={(e) => {
                  setNewLiftBarbell(e.target.checked);
                  if (e.target.checked) setNewLiftBodyweight(false);
                }}
                className="h-5 w-5 accent-[#ffffff]"
              />
              Barbell lift
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={newLiftBodyweight}
                onChange={(e) => {
                  setNewLiftBodyweight(e.target.checked);
                  if (e.target.checked) setNewLiftBarbell(false);
                }}
                className="h-5 w-5 accent-[#ffffff]"
              />
              Bodyweight
            </label>
          </div>
          <DialogFooter>
            <button
              type="button"
              disabled={newLiftName.trim().length === 0 || addLift.isPending}
              onClick={async () => {
                const lift = await addLift.mutateAsync({
                  name: newLiftName.trim(),
                  category: newLiftBodyweight ? "bodyweight" : "custom",
                  isBodyweight: newLiftBodyweight,
                  isCustom: true,
                  usesBarbell: newLiftBarbell,
                  defaultIncrement: unit === "kg" ? 2.5 : 5,
                  scene: newLiftBarbell
                    ? "generic-bar"
                    : newLiftBodyweight
                      ? "pullup"
                      : "generic-bar",
                });
                setSelectedLiftId(lift.id);
                setNewLiftName("");
                setShowNewLift(false);
              }}
              className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Create lift
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
