"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { BASE_PATH } from "@/lib/basePath";
import { bootstrapOnFirstRun } from "@/lib/db/seed";
import { usePrefs } from "@/lib/queries";

function FirstRunBootstrap() {
  const qc = useQueryClient();
  useEffect(() => {
    // useLifts also awaits this (gating reads); this pass just refreshes any
    // query that resolved before seeding finished on the very first launch.
    void bootstrapOnFirstRun().then(() => {
      void qc.invalidateQueries();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function ReducedMotionSync() {
  const { data: prefs } = usePrefs();
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = prefs?.reducedMotion
      ? "true"
      : "false";
  }, [prefs?.reducedMotion]);
  return null;
}

function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register(`${BASE_PATH}/sw.js`).catch(() => {
        // Offline support is progressive enhancement; the app works without it.
      });
    }
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // IndexedDB is local: no network flakiness, no refetch storms.
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <FirstRunBootstrap />
      <ReducedMotionSync />
      <ServiceWorkerRegistration />
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#1c1c1e",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "#ffffff",
          },
        }}
      />
    </QueryClientProvider>
  );
}
