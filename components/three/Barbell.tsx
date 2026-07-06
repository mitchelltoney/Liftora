"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { PlateSolution } from "@/lib/plates/solve";
import { DARK_STEEL, getKnurlNormalMap, STEEL } from "./materials";

/**
 * Physically-proportioned Olympic bar, procedurally built:
 *   shaft 28mm ø × 1310mm between sleeves, sleeves 50mm ø × 415mm.
 * World units: 1 = 1m. Plates come exactly from the solver — the scene
 * renders what the math says, never an approximation of it.
 *
 * Plates are lathe-turned solids (raised rim band, recessed face, raised
 * hub around the bore) so light rakes across real geometry instead of a
 * flat cylinder — no decorative glow rings.
 */

export const BAR = {
  shaftRadius: 0.014,
  shaftLength: 1.31,
  sleeveRadius: 0.025,
  sleeveLength: 0.415,
  collarWidth: 0.03,
  collarRadius: 0.045,
} as const;

const PLATE_GAP = 0.002;
const BORE = 0.0265;
const HUB_R = 0.058;

/** Machined plate cross-section, revolved. Cached per (R, T) pair. */
const profileCache = new Map<string, THREE.Vector2[]>();
function plateProfile(R: number, T: number): THREE.Vector2[] {
  const key = `${R}:${T}`;
  const cached = profileCache.get(key);
  if (cached) return cached;
  const rimW = Math.min(0.014, R * 0.09);
  const rec = Math.min(0.006, T * 0.5); // face recess depth
  const ch = Math.min(0.0025, T * 0.3); // edge chamfer
  const pts = [
    new THREE.Vector2(BORE, -T),
    new THREE.Vector2(HUB_R, -T),
    new THREE.Vector2(HUB_R + 0.004, -T + rec),
    new THREE.Vector2(R - rimW, -T + rec),
    new THREE.Vector2(R - rimW + 0.003, -T),
    new THREE.Vector2(R - ch, -T),
    new THREE.Vector2(R, -T + ch),
    new THREE.Vector2(R, T - ch),
    new THREE.Vector2(R - ch, T),
    new THREE.Vector2(R - rimW + 0.003, T),
    new THREE.Vector2(R - rimW, T - rec),
    new THREE.Vector2(HUB_R + 0.004, T - rec),
    new THREE.Vector2(HUB_R, T),
    new THREE.Vector2(BORE, T),
  ];
  profileCache.set(key, pts);
  return pts;
}

export interface BarbellProps {
  solution: PlateSolution;
}

export function Barbell({ solution }: BarbellProps) {
  const knurl = useMemo(() => getKnurlNormalMap(), []);
  const plates = solution.kind === "loaded" ? solution.perSide : [];

  const sideAssembly = (side: 1 | -1) => {
    let cursor = BAR.shaftLength / 2 + BAR.collarWidth;
    return (
      <group key={side}>
        {/* Inner collar */}
        <mesh
          position={[side * (BAR.shaftLength / 2 + BAR.collarWidth / 2), 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry
            args={[BAR.collarRadius, BAR.collarRadius, BAR.collarWidth, 40]}
          />
          <meshStandardMaterial {...STEEL} roughness={0.3} />
        </mesh>
        {/* Sleeve */}
        <mesh
          position={[side * (BAR.shaftLength / 2 + BAR.collarWidth + BAR.sleeveLength / 2), 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry
            args={[BAR.sleeveRadius, BAR.sleeveRadius, BAR.sleeveLength, 40]}
          />
          <meshPhysicalMaterial
            {...STEEL}
            roughness={0.14}
            clearcoat={1}
            clearcoatRoughness={0.12}
          />
        </mesh>
        {/* Sleeve end cap + retaining bolt detail */}
        <mesh
          position={[side * (BAR.shaftLength / 2 + BAR.collarWidth + BAR.sleeveLength + 0.003), 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[BAR.sleeveRadius - 0.003, BAR.sleeveRadius - 0.003, 0.006, 32]} />
          <meshStandardMaterial {...DARK_STEEL} roughness={0.4} />
        </mesh>
        <mesh
          position={[side * (BAR.shaftLength / 2 + BAR.collarWidth + BAR.sleeveLength + 0.009), 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.011, 0.011, 0.012, 20]} />
          <meshStandardMaterial {...STEEL} roughness={0.25} />
        </mesh>
        {/* Plates: largest inboard → smallest outboard, exact solver order. */}
        {plates.map((plate, i) => {
          const thickness = plate.thicknessMm / 1000;
          const radius = plate.diameterMm / 2000;
          const x = side * (cursor + thickness / 2);
          cursor += thickness + PLATE_GAP;
          const isKg = solution.unit === "kg";
          return (
            <group key={`${side}-${i}`} position={[x, 0, 0]}>
              <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                <latheGeometry
                  args={[plateProfile(radius, thickness / 2), 72]}
                />
                <meshPhysicalMaterial
                  color={isKg ? plate.color : "#2e3238"}
                  metalness={isKg ? 0.25 : 0.85}
                  roughness={isKg ? 0.4 : 0.32}
                  clearcoat={isKg ? 0.5 : 0.55}
                  clearcoatRoughness={0.28}
                  envMapIntensity={1.35}
                />
              </mesh>
              {/* Hub sleeve seat */}
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry
                  args={[BAR.sleeveRadius + 0.004, BAR.sleeveRadius + 0.004, thickness + 0.001, 28]}
                />
                <meshStandardMaterial {...DARK_STEEL} roughness={0.5} />
              </mesh>
            </group>
          );
        })}
      </group>
    );
  };

  return (
    <group>
      {/* Shaft with knurl normal map */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry
          args={[BAR.shaftRadius, BAR.shaftRadius, BAR.shaftLength, 32]}
        />
        <meshStandardMaterial
          {...STEEL}
          roughness={0.3}
          normalMap={knurl}
          normalScale={new THREE.Vector2(0.25, 0.25)}
        />
      </mesh>
      {sideAssembly(1)}
      {sideAssembly(-1)}
    </group>
  );
}

/** Outer edge of the loaded bar (for camera framing): half-width in meters. */
export function loadedHalfWidth(solution: PlateSolution): number {
  const base = BAR.shaftLength / 2 + BAR.collarWidth + BAR.sleeveLength;
  if (solution.kind !== "loaded") return base;
  return base;
}

/** Largest plate radius (m) — used to rest the bar on the floor for deadlift. */
export function largestPlateRadius(solution: PlateSolution): number {
  if (solution.kind !== "loaded" || solution.perSide.length === 0) {
    return BAR.collarRadius;
  }
  return solution.perSide[0].diameterMm / 2000;
}
