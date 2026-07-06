"use client";

import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageShell, ScreenHeader } from "@/components/hud/PageShell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImportError } from "@/lib/db/export";
import { displayWeight, toKg } from "@/lib/units";
import {
  useClearDemo,
  useDemoSeeded,
  useExportData,
  useImportData,
  usePrefs,
  useSeedDemo,
  useUpdatePrefs,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

function Row({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-forge-cyan/10 py-4 last:border-b-0">
      <div>
        <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function SettingsScreen() {
  const { data: prefs } = usePrefs();
  const updatePrefs = useUpdatePrefs();
  const { data: demoSeeded } = useDemoSeeded();
  const seedDemo = useSeedDemo();
  const clearDemo = useClearDemo();
  const exportData = useExportData();
  const importData = useImportData();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<string | null>(null);

  if (!prefs) {
    return (
      <PageShell>
        <div className="glass-panel scanlines flex h-64 items-center justify-center">
          <span className="hud-label animate-live-dot text-muted-foreground">
            Loading settings
          </span>
        </div>
      </PageShell>
    );
  }

  const unit = prefs.unit;
  const bodyweightDisplay =
    prefs.bodyweightKg === null ? "" : String(displayWeight(prefs.bodyweightKg, unit));

  const handleExport = async () => {
    try {
      const file = await exportData.mutateAsync();
      const blob = new Blob([JSON.stringify(file, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `liftora-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Archive exported");
    } catch {
      toast.error("Export failed");
    }
  };

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    setPendingImport(text);
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    try {
      const file = await importData.mutateAsync(pendingImport);
      toast.success(
        `Imported ${file.sessions.length} sessions, ${file.sets.length} sets`,
      );
    } catch (err) {
      toast.error(
        err instanceof ImportError ? err.message : "Import failed — file unreadable",
      );
    } finally {
      setPendingImport(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <PageShell>
      <ScreenHeader title="Settings" eyebrow="Forge configuration" />

      <section aria-label="Units and body" className="glass-panel mb-4 px-4">
        <Row label="Unit" hint="Applies everywhere, including the 3D plate math">
          <div role="group" aria-label="Weight unit" className="flex gap-1">
            {(["lb", "kg"] as const).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={unit === u}
                onClick={() => updatePrefs.mutate({ unit: u })}
                className={cn(
                  "hud-label min-h-11 rounded-lg border px-4 transition-colors",
                  unit === u
                    ? "border-forge-cyan/60 bg-forge-cyan/10 text-forge-cyan-hi"
                    : "border-forge-cyan/15 text-muted-foreground hover:text-foreground",
                )}
              >
                {u.toUpperCase()}
              </button>
            ))}
          </div>
        </Row>
        <Row
          label={`Bodyweight (${unit})`}
          hint="Counts toward volume and PRs on bodyweight lifts"
          htmlFor="settings-bw"
        >
          <input
            id="settings-bw"
            type="number"
            inputMode="decimal"
            defaultValue={bodyweightDisplay}
            key={`${unit}-${bodyweightDisplay}`}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v > 0) {
                updatePrefs.mutate({ bodyweightKg: toKg(v, unit) });
              }
            }}
            className="tabular min-h-11 w-24 rounded-lg border border-forge-cyan/25 bg-forge-panel px-3 text-right text-foreground"
          />
        </Row>
      </section>

      <section aria-label="Training targets" className="glass-panel mb-4 px-4">
        <Row
          label="Weekly session target"
          hint="Feeds the gold week streak"
          htmlFor="settings-target"
        >
          <div className="flex items-center gap-2">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={prefs.weeklyTarget === n}
                aria-label={`${n} sessions per week`}
                onClick={() => updatePrefs.mutate({ weeklyTarget: n })}
                className={cn(
                  "tabular flex h-11 w-11 items-center justify-center rounded-lg border transition-colors",
                  prefs.weeklyTarget === n
                    ? "border-forge-gold/60 bg-forge-gold/10 text-forge-gold"
                    : "border-forge-cyan/15 text-muted-foreground hover:text-foreground",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </Row>
        <Row
          label="Rest timer default"
          hint="Auto-starts after each committed set"
          htmlFor="settings-rest"
        >
          <select
            id="settings-rest"
            value={prefs.restTimerDefault}
            onChange={(e) =>
              updatePrefs.mutate({ restTimerDefault: Number(e.target.value) })
            }
            className="tabular min-h-11 rounded-lg border border-forge-cyan/25 bg-forge-panel px-3 text-foreground"
          >
            {[60, 90, 120, 150, 180, 240, 300].map((s) => (
              <option key={s} value={s}>
                {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
              </option>
            ))}
          </select>
        </Row>
        <Row
          label="Week starts on"
          hint="Streak and heatmap boundaries"
        >
          <div role="group" aria-label="Week start day" className="flex gap-1">
            {([
              [1, "MON"],
              [0, "SUN"],
            ] as const).map(([day, label]) => (
              <button
                key={day}
                type="button"
                aria-pressed={prefs.weekStartsOn === day}
                onClick={() => updatePrefs.mutate({ weekStartsOn: day })}
                className={cn(
                  "hud-label min-h-11 rounded-lg border px-4 transition-colors",
                  prefs.weekStartsOn === day
                    ? "border-forge-cyan/60 bg-forge-cyan/10 text-forge-cyan-hi"
                    : "border-forge-cyan/15 text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Row>
      </section>

      <section aria-label="Motion" className="glass-panel mb-4 px-4">
        <Row
          label="Reduced motion"
          hint="Static loaded-bar renders, no particles or camera motion"
          htmlFor="settings-motion"
        >
          <button
            id="settings-motion"
            type="button"
            role="switch"
            aria-checked={prefs.reducedMotion}
            onClick={() =>
              updatePrefs.mutate({ reducedMotion: !prefs.reducedMotion })
            }
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full border transition-colors",
              prefs.reducedMotion
                ? "border-forge-cyan/60 bg-forge-cyan/30"
                : "border-forge-cyan/20 bg-forge-panel-hi",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute top-0.5 h-[22px] w-[22px] rounded-full transition-all",
                prefs.reducedMotion
                  ? "left-[22px] bg-forge-cyan glow-cyan"
                  : "left-0.5 bg-muted-foreground",
              )}
            />
          </button>
        </Row>
      </section>

      <section aria-label="Data" className="glass-panel mb-4 px-4">
        <Row label="Export archive" hint="Full database as JSON — your data is never trapped">
          <button
            type="button"
            onClick={() => void handleExport()}
            className="flex min-h-11 items-center gap-2 rounded-lg border border-forge-cyan/30 px-4 text-sm text-forge-cyan-hi transition-colors hover:bg-forge-cyan/10"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export
          </button>
        </Row>
        <Row label="Import archive" hint="Replaces the current database entirely">
          <>
            <input
              ref={fileInput}
              type="file"
              accept="application/json"
              className="sr-only"
              id="settings-import"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex min-h-11 items-center gap-2 rounded-lg border border-forge-cyan/30 px-4 text-sm text-forge-cyan-hi transition-colors hover:bg-forge-cyan/10"
            >
              <Upload className="h-4 w-4" aria-hidden />
              Import
            </button>
          </>
        </Row>
        <Row
          label={demoSeeded ? "Clear demo data" : "Load demo data"}
          hint={
            demoSeeded
              ? "Removes every demo-flagged session, set, and PR"
              : "Six weeks of labeled sample training"
          }
        >
          <button
            type="button"
            disabled={seedDemo.isPending || clearDemo.isPending}
            onClick={() =>
              demoSeeded
                ? clearDemo.mutate(undefined, {
                    onSuccess: () => toast.success("Demo data cleared"),
                  })
                : seedDemo.mutate(undefined, {
                    onSuccess: () => toast.success("Demo data loaded"),
                  })
            }
            className={cn(
              "min-h-11 rounded-lg border px-4 text-sm transition-colors disabled:opacity-50",
              demoSeeded
                ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                : "border-forge-magenta/40 text-forge-magenta hover:bg-forge-magenta/10",
            )}
          >
            {demoSeeded ? "Clear" : "Load"}
          </button>
        </Row>
      </section>

      <p className="hud-label text-center text-muted-foreground">
        Liftora · local-first · your data lives on this device
      </p>

      {/* Import confirmation — destructive, so it must be deliberate. */}
      <Dialog open={pendingImport !== null} onOpenChange={(open) => !open && setPendingImport(null)}>
        <DialogContent className="glass-panel border-forge-cyan/25">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider">
              Replace database?
            </DialogTitle>
            <DialogDescription>
              Importing replaces every session, set, PR, lift, and preference
              with the file&apos;s contents. Export first if you want a backup.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setPendingImport(null)}
              className="min-h-11 rounded-xl border border-forge-cyan/25 px-4 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmImport()}
              className="min-h-11 rounded-xl border border-destructive/50 bg-destructive/15 px-4 font-display text-sm font-bold tracking-wider text-destructive"
            >
              Replace everything
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
