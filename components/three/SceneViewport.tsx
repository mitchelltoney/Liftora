"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { HudFrame } from "@/components/hud/HudFrame";
import { useMediaQuery } from "@/lib/hooks";
import { usePrefs } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { LiftSceneProps } from "./LiftScene";

/** Styled suspense fallback: the viewport calibrating, not a blank void. */
function SceneFallback({ tall }: { tall?: boolean }) {
  return (
    <div
      className={cn(
        "scanlines hud-grid flex w-full items-center justify-center rounded-xl bg-forge-panel",
        tall ? "h-72 md:h-80" : "h-56 md:h-72",
      )}
      role="status"
      aria-label="Loading 3D scene"
    >
      <span className="hud-label animate-live-dot text-muted-foreground">
        Loading scene
      </span>
    </div>
  );
}

// 3D code (three.js + R3F + postprocessing) loads ONLY when a viewport
// mounts — non-3D routes never pay for it.
const LiftScene = dynamic(() => import("./LiftScene"), {
  ssr: false,
  loading: () => <SceneFallback />,
});

const AmbientForge = dynamic(() => import("./AmbientForge"), {
  ssr: false,
  loading: () => <SceneFallback tall />,
});

/** True on hardware that can afford DoF + MSAA (rough but honest heuristic). */
function useHighTier(): boolean {
  const fine = useMediaQuery("(pointer: fine)");
  const wide = useMediaQuery("(min-width: 768px)");
  const [cores] = useState(() =>
    typeof navigator === "undefined" ? 4 : (navigator.hardwareConcurrency ?? 4),
  );
  return fine && wide && cores >= 6;
}

function useEffectiveReducedMotion(): boolean {
  const { data: prefs } = usePrefs();
  const system = useMediaQuery("(prefers-reduced-motion: reduce)");
  return system || Boolean(prefs?.reducedMotion);
}

/** Lift scene viewport with HUD brackets and micro-labels. */
export function LiftViewport({
  label,
  sublabel,
  gold,
  className,
  ...scene
}: Omit<LiftSceneProps, "reducedMotion" | "highTier"> & {
  label?: string;
  sublabel?: string;
  gold?: boolean;
  className?: string;
}) {
  const reducedMotion = useEffectiveReducedMotion();
  const highTier = useHighTier();
  return (
    <HudFrame label={label} sublabel={sublabel} gold={gold} className={className}>
      <div className="h-56 w-full overflow-hidden rounded-xl md:h-72">
        <LiftScene {...scene} reducedMotion={reducedMotion} highTier={highTier} />
      </div>
    </HudFrame>
  );
}

/** Nexus ambient viewport. */
export function AmbientViewport({ className }: { className?: string }) {
  const reducedMotion = useEffectiveReducedMotion();
  return (
    <HudFrame label="Ambient" className={className}>
      <div className="h-64 w-full overflow-hidden rounded-xl md:h-80">
        <AmbientForge reducedMotion={reducedMotion} />
      </div>
    </HudFrame>
  );
}
