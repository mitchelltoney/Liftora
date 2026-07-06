"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { exportAll, importAll, parseExportFile } from "./db/export";
import {
  addLift,
  deleteSet,
  discardSession,
  endSession,
  getActiveSession,
  getAllPRs,
  getAllSets,
  getCompletedSessions,
  getPrefs,
  getSetsForSession,
  reorderSets,
  saveSet,
  setPrefs,
  startOrResumeSession,
} from "./db/repo";
import {
  bootstrapOnFirstRun,
  clearDemoData,
  ensureCoreLifts,
  hasSeededDemo,
  seedDemoData,
} from "./db/seed";
import type { Lift, Prefs } from "./types";

export const keys = {
  prefs: ["prefs"] as const,
  lifts: ["lifts"] as const,
  activeSession: ["activeSession"] as const,
  sessions: ["sessions"] as const,
  sessionSets: (id: string) => ["sessionSets", id] as const,
  allSets: ["allSets"] as const,
  prs: ["prs"] as const,
  demo: ["demoSeeded"] as const,
};

/** Everything that changes when sets/sessions/prs mutate. */
function invalidateTrainingData(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: keys.sessions });
  void qc.invalidateQueries({ queryKey: keys.allSets });
  void qc.invalidateQueries({ queryKey: keys.prs });
  void qc.invalidateQueries({ queryKey: ["sessionSets"] });
  void qc.invalidateQueries({ queryKey: keys.demo });
}

// ---------------------------------------------------------------- prefs ----

export function usePrefs() {
  return useQuery({ queryKey: keys.prefs, queryFn: getPrefs });
}

export function useUpdatePrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Prefs>) => setPrefs(patch),
    onSuccess: (next) => {
      qc.setQueryData(keys.prefs, next);
    },
  });
}

// ---------------------------------------------------------------- lifts ----

export function useLifts() {
  return useQuery({
    queryKey: keys.lifts,
    queryFn: async () => {
      // First-run bootstrap gates every lift read: no screen can observe a
      // half-seeded database.
      await bootstrapOnFirstRun();
      const lifts = await ensureCoreLifts();
      return lifts.sort((a, b) => a.createdAt - b.createdAt);
    },
  });
}

export function useAddLift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lift: Omit<Lift, "id" | "createdAt">) => addLift(lift),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.lifts }),
  });
}

// ------------------------------------------------------------- sessions ----

export function useActiveSession() {
  return useQuery({ queryKey: keys.activeSession, queryFn: getActiveSession });
}

export function useStartSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: startOrResumeSession,
    onSuccess: (session) => {
      qc.setQueryData(keys.activeSession, session);
    },
  });
}

export function useEndSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, notes }: { sessionId: string; notes?: string }) =>
      endSession(sessionId, notes),
    onSuccess: () => {
      qc.setQueryData(keys.activeSession, null);
      invalidateTrainingData(qc);
    },
  });
}

export function useDiscardSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => discardSession(sessionId),
    onSuccess: () => {
      qc.setQueryData(keys.activeSession, null);
      invalidateTrainingData(qc);
    },
  });
}

export function useCompletedSessions() {
  return useQuery({ queryKey: keys.sessions, queryFn: getCompletedSessions });
}

// ----------------------------------------------------------------- sets ----

export function useSessionSets(sessionId: string | undefined) {
  return useQuery({
    queryKey: keys.sessionSets(sessionId ?? "none"),
    queryFn: () => getSetsForSession(sessionId!),
    enabled: Boolean(sessionId),
  });
}

export function useAllSets() {
  return useQuery({ queryKey: keys.allSets, queryFn: getAllSets });
}

export function useSaveSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveSet,
    onSuccess: (_result, vars) => {
      void qc.invalidateQueries({ queryKey: keys.sessionSets(vars.sessionId) });
      void qc.invalidateQueries({ queryKey: keys.allSets });
      void qc.invalidateQueries({ queryKey: keys.prs });
    },
  });
}

export function useDeleteSet(sessionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (setId: string) => deleteSet(setId),
    onSuccess: () => {
      if (sessionId) {
        void qc.invalidateQueries({ queryKey: keys.sessionSets(sessionId) });
      }
      void qc.invalidateQueries({ queryKey: keys.allSets });
      void qc.invalidateQueries({ queryKey: keys.prs });
    },
  });
}

export function useReorderSets(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => reorderSets(sessionId, orderedIds),
    onMutate: async (orderedIds) => {
      // Optimistic: reorder the cached list immediately for drag feedback.
      await qc.cancelQueries({ queryKey: keys.sessionSets(sessionId) });
      const previous = qc.getQueryData(keys.sessionSets(sessionId));
      qc.setQueryData(
        keys.sessionSets(sessionId),
        (old: Awaited<ReturnType<typeof getSetsForSession>> | undefined) => {
          if (!old) return old;
          // The reordered ids are a per-lift SUBSET: reassign the slots that
          // subset already occupies, leave every other set untouched.
          const subset = old.filter((s) => orderedIds.includes(s.id));
          const slots = subset.map((s) => s.orderIndex).sort((a, b) => a - b);
          const slotById = new Map(
            orderedIds
              .filter((id) => subset.some((s) => s.id === id))
              .map((id, i) => [id, slots[i]]),
          );
          return old
            .map((s) =>
              slotById.has(s.id) ? { ...s, orderIndex: slotById.get(s.id)! } : s,
            )
            .sort((a, b) => a.orderIndex - b.orderIndex);
        },
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(keys.sessionSets(sessionId), ctx.previous);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.sessionSets(sessionId) });
    },
  });
}

// ------------------------------------------------------------------ PRs ----

export function usePRs() {
  return useQuery({ queryKey: keys.prs, queryFn: getAllPRs });
}

// ------------------------------------------------------- demo & data ops ----

export function useDemoSeeded() {
  return useQuery({ queryKey: keys.demo, queryFn: hasSeededDemo });
}

export function useSeedDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: seedDemoData,
    onSuccess: () => invalidateTrainingData(qc),
  });
}

export function useClearDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clearDemoData,
    onSuccess: () => invalidateTrainingData(qc),
  });
}

export function useExportData() {
  return useMutation({ mutationFn: exportAll });
}

export function useImportData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: string) => {
      const file = parseExportFile(json);
      await importAll(file);
      return file;
    },
    onSuccess: () => {
      void qc.invalidateQueries();
    },
  });
}
