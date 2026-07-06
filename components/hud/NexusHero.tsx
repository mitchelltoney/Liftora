"use client";

import { Component, type ReactNode, useSyncExternalStore } from "react";
import { Card } from "@/components/ui/card";
import { SplineScene } from "@/components/ui/splite";
import { Spotlight } from "@/components/ui/spotlight";
import { AmbientViewport } from "@/components/three/SceneViewport";

/**
 * Nexus hero, adapted from the 21st.dev SplineScene + Spotlight demo.
 * The interactive Spline scene streams from spline.design, so it renders
 * only when online; offline (or on any load failure) the hero swaps to the
 * local procedural ambient scene — the PWA never shows a dead panel.
 */

class SceneErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("online", onChange);
      window.addEventListener("offline", onChange);
      return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

export function NexusHero() {
  const online = useOnline();

  if (!online) {
    return <AmbientViewport className="mb-4" />;
  }

  return (
    <Card className="relative mb-4 h-[440px] w-full overflow-hidden border-white/10 bg-black/[0.96] md:h-[420px]">
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="white" />

      <div className="flex h-full flex-col md:flex-row">
        <div className="relative z-10 flex flex-1 flex-col justify-center p-6 md:p-8">
          <h1 className="bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-5xl">
            Lift. Log. Repeat.
          </h1>
          <p className="mt-3 max-w-lg text-sm text-neutral-400 md:mt-4 md:text-base">
            A clean, modern lifting log.
          </p>
        </div>

        <div className="relative min-h-[180px] flex-1">
          <SceneErrorBoundary fallback={<AmbientViewport />}>
            <SplineScene
              scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
              className="h-full w-full"
            />
          </SceneErrorBoundary>
        </div>
      </div>
    </Card>
  );
}
