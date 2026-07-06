"use client";

import { useMemo } from "react";
import { ContactShadows, MeshReflectorMaterial, RoundedBox } from "@react-three/drei";
import type { PlateSpec } from "@/lib/plates/solve";
import {
  DARK_STEEL,
  getConcreteRoughnessMap,
  RIG_FRAME,
  STEEL,
} from "./materials";

/**
 * Procedural gym equipment, product-shot treatment: rounded steel box
 * sections (no CAD-sharp primitives), matte powder-coat frames, and a
 * glossy dark floor with soft blurred reflections + contact shadows.
 * Dimensions are real-world plausible (bench pad 0.43m, rack ~2.3m,
 * pull-up bar 2.2m).
 */

export function Floor({ highTier = false }: { highTier?: boolean }) {
  const roughnessMap = useMemo(() => getConcreteRoughnessMap(), []);
  return (
    <group>
      {/* Polished dark concrete: roughness map smudges the reflections so
          they streak and break like a real studio floor. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
        <planeGeometry args={[20, 20]} />
        <MeshReflectorMaterial
          blur={[280, 80]}
          resolution={highTier ? 1024 : 512}
          mixBlur={1}
          mixStrength={11}
          roughnessMap={roughnessMap}
          roughness={0.55}
          depthScale={1.15}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#0b0c0f"
          metalness={0.4}
          mirror={0.55}
        />
      </mesh>
      {/* Soft ambient-occlusion-style shadows under everything. */}
      <ContactShadows
        position={[0, 0.004, 0]}
        opacity={0.62}
        scale={7}
        blur={2.4}
        far={2.4}
        resolution={512}
        color="#000000"
      />
      {/* Infinity-cove backdrop: catches a soft light pool for depth. */}
      <mesh position={[0, 3.2, -6.5]}>
        <planeGeometry args={[28, 13]} />
        <meshStandardMaterial color="#0b0c0f" metalness={0} roughness={0.95} />
      </mesh>
    </group>
  );
}

function Upright({
  x,
  z,
  height,
}: {
  x: number;
  z: number;
  height: number;
}) {
  return (
    <RoundedBox
      args={[0.075, height, 0.075]}
      radius={0.008}
      smoothness={4}
      position={[x, height / 2, z]}
      castShadow
    >
      <meshStandardMaterial {...RIG_FRAME} />
    </RoundedBox>
  );
}

/** J-hook pair to rest the bar on. */
function JHooks({ y, z = 0 }: { y: number; z?: number }) {
  return (
    <>
      {[-0.55, 0.55].map((x) => (
        <group key={x} position={[x, y, z]}>
          <RoundedBox args={[0.07, 0.06, 0.16]} radius={0.006} smoothness={4} castShadow>
            <meshStandardMaterial {...DARK_STEEL} />
          </RoundedBox>
          <RoundedBox
            args={[0.07, 0.07, 0.032]}
            radius={0.006}
            smoothness={4}
            position={[0, 0.055, 0.065]}
            castShadow
          >
            <meshStandardMaterial {...DARK_STEEL} />
          </RoundedBox>
        </group>
      ))}
    </>
  );
}

/** Flat bench + rack uprights. */
export function BenchStation({ barY }: { barY: number }) {
  return (
    <group>
      {/* Pad */}
      <RoundedBox
        args={[0.32, 0.07, 1.24]}
        radius={0.02}
        smoothness={4}
        position={[0, 0.43, 0.32]}
        castShadow
      >
        <meshStandardMaterial color="#101216" roughness={0.95} envMapIntensity={0.3} />
      </RoundedBox>
      {/* Bench legs */}
      {[-0.16, 0.8].map((z) => (
        <RoundedBox
          key={z}
          args={[0.24, 0.4, 0.07]}
          radius={0.008}
          smoothness={4}
          position={[0, 0.2, z]}
          castShadow
        >
          <meshStandardMaterial {...RIG_FRAME} />
        </RoundedBox>
      ))}
      {/* Uprights + hooks */}
      <Upright x={-0.55} z={-0.18} height={1.3} />
      <Upright x={0.55} z={-0.18} height={1.3} />
      <JHooks y={barY - 0.05} z={-0.18} />
    </group>
  );
}

/** Power-rack front for squat: taller uprights, hooks at shoulder height. */
export function SquatRack({ barY }: { barY: number }) {
  return (
    <group>
      <Upright x={-0.55} z={-0.25} height={2.3} />
      <Upright x={0.55} z={-0.25} height={2.3} />
      {/* Crossmember */}
      <RoundedBox
        args={[1.24, 0.075, 0.075]}
        radius={0.008}
        smoothness={4}
        position={[0, 2.26, -0.25]}
        castShadow
      >
        <meshStandardMaterial {...RIG_FRAME} />
      </RoundedBox>
      <JHooks y={barY - 0.05} z={-0.25} />
      {/* Safety pins */}
      {[-0.55, 0.55].map((x) => (
        <RoundedBox
          key={x}
          args={[0.05, 0.05, 0.62]}
          radius={0.006}
          smoothness={4}
          position={[x, 0.62, 0.05]}
          castShadow
        >
          <meshStandardMaterial {...DARK_STEEL} />
        </RoundedBox>
      ))}
    </group>
  );
}

/** Pull-up rig: tall frame + knurled crossbar. */
export function PullupRig() {
  return (
    <group>
      <Upright x={-0.7} z={0} height={2.35} />
      <Upright x={0.7} z={0} height={2.35} />
      {/* Crossbar at 2.2m */}
      <mesh position={[0, 2.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.016, 0.016, 1.44, 28]} />
        <meshStandardMaterial {...STEEL} roughness={0.3} />
      </mesh>
      {/* Clamp collars where the bar meets the frame */}
      {[-0.66, 0.66].map((x) => (
        <mesh key={x} position={[x, 2.2, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.022, 0.022, 0.05, 20]} />
          <meshStandardMaterial {...DARK_STEEL} />
        </mesh>
      ))}
      {/* Base feet */}
      {[-0.7, 0.7].map((x) => (
        <RoundedBox
          key={x}
          args={[0.4, 0.04, 0.7]}
          radius={0.01}
          smoothness={4}
          position={[x, 0.02, 0]}
          castShadow
        >
          <meshStandardMaterial {...RIG_FRAME} />
        </RoundedBox>
      ))}
    </group>
  );
}

/** Dip station: two parallel bars at 1.25m. */
export function DipStation() {
  return (
    <group>
      {[-0.28, 0.28].map((x) => (
        <group key={x}>
          {/* Handle */}
          <mesh position={[x, 1.25, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.018, 0.018, 0.62, 28]} />
            <meshStandardMaterial {...STEEL} roughness={0.3} />
          </mesh>
          {/* Legs */}
          {[-0.24, 0.24].map((z) => (
            <RoundedBox
              key={z}
              args={[0.05, 1.25, 0.05]}
              radius={0.006}
              smoothness={4}
              position={[x, 0.625, z]}
              castShadow
            >
              <meshStandardMaterial {...RIG_FRAME} />
            </RoundedBox>
          ))}
          <RoundedBox
            args={[0.3, 0.04, 0.66]}
            radius={0.01}
            smoothness={4}
            position={[x, 0.02, 0]}
            castShadow
          >
            <meshStandardMaterial {...RIG_FRAME} />
          </RoundedBox>
        </group>
      ))}
    </group>
  );
}

/**
 * Added weight for bodyweight lifts, staged the way a gym actually looks:
 * the denominated plates lie stacked flat on the floor at the base of the
 * rig with the dip-belt chain draped over the top plate. Assistance is a
 * band hanging from the bar. Nothing floats.
 */
export function BeltPlate({
  visible,
  assisted,
  plates,
  barY,
  stackPos,
}: {
  visible: boolean;
  assisted: boolean;
  /** Denominated plates for the TOTAL added load (not per side). */
  plates: PlateSpec[];
  /** Bar height the assistance band hangs from. */
  barY: number;
  /** [x, z] floor position for the staged plate stack. */
  stackPos: [number, number];
}) {
  if (!visible) return null;

  if (assisted) {
    // Assistance band looped over the bar.
    return (
      <mesh position={[0.25, barY - 0.115, 0]} castShadow>
        <torusGeometry args={[0.115, 0.009, 10, 40]} />
        <meshStandardMaterial
          color="#8a8d94"
          metalness={0.05}
          roughness={0.8}
          envMapIntensity={0.5}
        />
      </mesh>
    );
  }

  // Flat stack, largest plate at the bottom.
  const stack: { t: number; r: number; y: number; key: number }[] = [];
  let yCursor = 0;
  for (let i = 0; i < plates.length; i++) {
    const t = plates[i].thicknessMm / 1000;
    const r = plates[i].diameterMm / 2000;
    stack.push({ t, r, y: yCursor + t / 2, key: i });
    yCursor += t + 0.002;
  }
  const topY = yCursor;
  const topR = stack.length > 0 ? stack[stack.length - 1].r : 0.1;

  return (
    <group position={[stackPos[0], 0.002, stackPos[1]]}>
      {stack.map(({ t, r, y, key }) => (
        <mesh key={key} position={[0, y, 0]} castShadow>
          <cylinderGeometry args={[r, r, t, 48]} />
          <meshPhysicalMaterial
            color="#2e3238"
            metalness={0.85}
            roughness={0.32}
            clearcoat={0.55}
            clearcoatRoughness={0.28}
            envMapIntensity={1.35}
          />
        </mesh>
      ))}
      {/* Dip-belt chain threaded through the plate's center hole: a couple
          of links emerge from the bore, fold over, then the run meanders
          across the plate (deterministic random-walk heading) and drops
          over the edge onto the floor. Fixed link size throughout. */}
      {(() => {
        const STEP = 0.0185;
        const links: {
          pos: [number, number, number];
          rot: [number, number, number];
        }[] = [
          // Emerging from the bore, standing then folding over
          { pos: [0, topY + 0.014, 0], rot: [0.12, 0.5, 0] },
          { pos: [0.012, topY + 0.011, 0.008], rot: [0.7, 0.9, 0.15] },
        ];
        let x = 0.024;
        let z = 0.016;
        let heading = 0.55; // initial wander direction
        for (let i = 0; i < 12; i++) {
          const jitter = (((i * 73 + 29) % 17) / 17 - 0.5) * 0.55;
          heading += jitter;
          x += STEP * Math.cos(heading);
          z += STEP * Math.sin(heading) * 0.8;
          const dist = Math.hypot(x, z);
          const beyond = Math.max(0, dist - (topR - 0.012));
          const yy = Math.max(topY + 0.0035 - beyond * 1.8, 0.006);
          const onFloor = yy <= 0.007;
          links.push({
            pos: [x, yy, z],
            rot: [
              beyond > 0 && !onFloor ? 0.9 : Math.PI / 2 - 0.12,
              -heading + (i % 2 ? 0.5 : -0.35),
              i % 2 ? 0.3 : -0.15,
            ],
          });
        }
        return links.map((link, i) => (
          <mesh key={i} position={link.pos} rotation={link.rot}>
            <torusGeometry args={[0.0105, 0.0026, 8, 16]} />
            <meshStandardMaterial {...STEEL} roughness={0.35} />
          </mesh>
        ));
      })()}
    </group>
  );
}
export const PLATFORM_TOP = 0.036;

/**
 * Deadlift platform: a flat rubber pad on the floor — matte side lanes
 * where the plates land, slightly lighter center lane. Deadlift and
 * bent-over row both pull off this pad; the bar rests ON it.
 */
export function DeadliftPlatform() {
  return (
    <group>
      {/* Rubber base pad */}
      <RoundedBox
        args={[3.0, PLATFORM_TOP, 2.0]}
        radius={0.015}
        smoothness={4}
        position={[0, PLATFORM_TOP / 2 - 0.001, 0]}
        castShadow
      >
        {/* Polished dark rubber: mirrors the void like the floor does —
            a matte pad would pop gray under the same lights. */}
        <meshPhysicalMaterial
          color="#0a0b0d"
          metalness={0.1}
          roughness={0.55}
          clearcoat={0.85}
          clearcoatRoughness={0.3}
          envMapIntensity={0.5}
        />
      </RoundedBox>
      {/* Center stance lane, a shade lighter and slightly proud */}
      <RoundedBox
        args={[1.05, PLATFORM_TOP + 0.003, 2.0]}
        radius={0.015}
        smoothness={4}
        position={[0, (PLATFORM_TOP + 0.003) / 2 - 0.001, 0]}
      >
        <meshPhysicalMaterial
          color="#0e0f12"
          metalness={0.08}
          roughness={0.65}
          clearcoat={0.6}
          clearcoatRoughness={0.35}
          envMapIntensity={0.4}
        />
      </RoundedBox>
    </group>
  );
}

/**
 * Dumbbell head size curve: rapid early growth with a cutoff.
 * Anchors — R(20) = 2 × R(5), R(40) = 1.5 × R(20); growth tapers 40→60
 * and hard-caps past 60 lb.
 */
function dumbbellHeadRadius(weightLb: number): number {
  const w = Math.max(5, weightLb);
  if (w <= 20) return 0.03 + ((w - 5) / 15) * 0.03; // 0.030 → 0.060
  if (w <= 40) return 0.06 + ((w - 20) / 20) * 0.03; // 0.060 → 0.090
  if (w <= 60) return 0.09 + ((w - 40) / 20) * 0.012; // 0.090 → 0.102
  return 0.102; // cutoff
}

function dumbbellHeadLength(weightLb: number): number {
  const w = Math.max(5, Math.min(60, weightLb));
  return 0.032 + ((w - 5) / 55) * 0.058; // 0.032 → 0.090, capped with size
}

/** One pro-style round dumbbell, axis along Z. */
function Dumbbell({ weightLb }: { weightLb: number }) {
  const w = Math.max(5, Math.min(150, weightLb));
  const headR = dumbbellHeadRadius(w);
  const headLen = dumbbellHeadLength(w);
  const handleLen = 0.13;
  const half = handleLen / 2 + headLen / 2;
  return (
    <group>
      {/* Handle */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.0165, 0.0165, handleLen + headLen, 24]} />
        <meshStandardMaterial {...STEEL} roughness={0.35} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s} position={[0, 0, s * half]}>
          {/* Head: stacked discs, machined look */}
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[headR, headR, headLen * 0.72, 36]} />
            <meshPhysicalMaterial
              color="#2e3238"
              metalness={0.85}
              roughness={0.32}
              clearcoat={0.55}
              clearcoatRoughness={0.28}
              envMapIntensity={1.35}
            />
          </mesh>
          <mesh position={[0, 0, s * headLen * 0.42]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[headR * 0.72, headR * 0.72, headLen * 0.22, 30]} />
            <meshStandardMaterial {...DARK_STEEL} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Dumbbell scene: a two-tier saddle rack. The PAIR's position encodes the
 * weight — 5→20 lb slides across the top tier, 20→50 across the bottom;
 * past 50 the pair moves to a single stand and simply grows.
 */
export function DumbbellStation({ weightLb }: { weightLb: number }) {
  const w = Math.max(5, weightLb);
  const onStand = w > 50;
  const tierY = [1.0, 0.58];
  const slotX = onStand
    ? 0
    : w <= 20
      ? -0.62 + ((Math.min(w, 20) - 5) / 15) * 1.24
      : -0.62 + ((Math.min(w, 50) - 20) / 30) * 1.24;
  const tier = w <= 20 ? 0 : 1;
  const headR = dumbbellHeadRadius(w);
  const pairOff = headR + 0.02; // keep the pair from intersecting as it grows

  return (
    <group>
      {!onStand ? (
        <group>
          {/* Two-tier rack: side frames + angled shelves */}
          {[-0.85, 0.85].map((x) => (
            <group key={x}>
              <RoundedBox
                args={[0.06, 1.18, 0.08]}
                radius={0.006}
                smoothness={4}
                position={[x, 0.59, -0.12]}
                castShadow
              >
                <meshStandardMaterial {...RIG_FRAME} />
              </RoundedBox>
              <RoundedBox
                args={[0.06, 0.04, 0.66]}
                radius={0.006}
                smoothness={4}
                position={[x, 0.02, 0.05]}
                castShadow
              >
                <meshStandardMaterial {...RIG_FRAME} />
              </RoundedBox>
            </group>
          ))}
          {tierY.map((y, i) => (
            <RoundedBox
              key={i}
              args={[1.74, 0.045, 0.34]}
              radius={0.008}
              smoothness={4}
              position={[0, y, i === 0 ? -0.06 : 0.1]}
              rotation={[-0.22, 0, 0]}
              castShadow
            >
              <meshStandardMaterial {...DARK_STEEL} roughness={0.5} />
            </RoundedBox>
          ))}
          {/* The pair, resting in its weight slot */}
          <group
            position={[slotX, tierY[tier] + headR + 0.01, tier === 0 ? -0.06 : 0.1]}
            rotation={[-0.22, 0, 0]}
          >
            <group position={[-pairOff, 0, 0]}>
              <Dumbbell weightLb={w} />
            </group>
            <group position={[pairOff, 0, 0]}>
              <Dumbbell weightLb={w} />
            </group>
          </group>
        </group>
      ) : (
        <group>
          {/* Single heavy-dumbbell stand */}
          <RoundedBox
            args={[0.5, 0.05, 0.6]}
            radius={0.01}
            smoothness={4}
            position={[0, 0.025, 0]}
            castShadow
          >
            <meshStandardMaterial {...RIG_FRAME} />
          </RoundedBox>
          <RoundedBox
            args={[0.09, 0.75, 0.09]}
            radius={0.008}
            smoothness={4}
            position={[0, 0.42, 0]}
            castShadow
          >
            <meshStandardMaterial {...RIG_FRAME} />
          </RoundedBox>
          {/* Saddle arms */}
          {[-pairOff, pairOff].map((x) => (
            <RoundedBox
              key={x}
              args={[0.05, 0.04, 0.5]}
              radius={0.006}
              smoothness={4}
              position={[x, 0.8, 0]}
              castShadow
            >
              <meshStandardMaterial {...DARK_STEEL} />
            </RoundedBox>
          ))}
          <group position={[-pairOff, 0.82 + headR, 0]}>
            <Dumbbell weightLb={w} />
          </group>
          <group position={[pairOff, 0.82 + headR, 0]}>
            <Dumbbell weightLb={w} />
          </group>
        </group>
      )}
    </group>
  );
}

const STACK_PLATES = 16;
const STACK_PLATE_LB = 12.5;
const STACK_PLATE_H = 0.032;
const STACK_GAP = 0.004;
const STACK_BASE_Y = 0.32;

/**
 * Lat pulldown machine: frame, seat + thigh pad, top pulley, cable down to
 * a cambered bar, and a 16-plate weight stack whose selector pin steps
 * DOWN one plate per 12.5 lb as the working weight rises.
 */
export function LatPulldownMachine({ weightLb }: { weightLb: number }) {
  const selected = Math.max(1, Math.min(STACK_PLATES, Math.round(weightLb / STACK_PLATE_LB)));
  const stackTop = STACK_BASE_Y + STACK_PLATES * (STACK_PLATE_H + STACK_GAP);
  const pinY = stackTop - selected * (STACK_PLATE_H + STACK_GAP) + STACK_PLATE_H / 2;
  const stackX = 0.05;
  const stackZ = -0.62;
  const barY = 1.62;

  return (
    <group>
      {/* Main tower uprights (stack housing) */}
      {[-0.3, 0.4].map((x) => (
        <RoundedBox
          key={x}
          args={[0.08, 2.25, 0.08]}
          radius={0.008}
          smoothness={4}
          position={[stackX + x, 1.125, stackZ]}
          castShadow
        >
          <meshStandardMaterial {...RIG_FRAME} />
        </RoundedBox>
      ))}
      {/* Tower crown + forward arm to the pulley over the seat */}
      <RoundedBox
        args={[0.86, 0.08, 0.1]}
        radius={0.008}
        smoothness={4}
        position={[stackX + 0.05, 2.29, stackZ]}
        castShadow
      >
        <meshStandardMaterial {...RIG_FRAME} />
      </RoundedBox>
      <RoundedBox
        args={[0.08, 0.07, 0.95]}
        radius={0.008}
        smoothness={4}
        position={[0, 2.28, stackZ + 0.45]}
        castShadow
      >
        <meshStandardMaterial {...RIG_FRAME} />
      </RoundedBox>
      {/* Base feet */}
      <RoundedBox
        args={[1.1, 0.05, 0.5]}
        radius={0.01}
        smoothness={4}
        position={[stackX + 0.05, 0.025, stackZ]}
        castShadow
      >
        <meshStandardMaterial {...RIG_FRAME} />
      </RoundedBox>
      <RoundedBox
        args={[0.3, 0.05, 1.5]}
        radius={0.01}
        smoothness={4}
        position={[0, 0.025, stackZ + 0.8]}
        castShadow
      >
        <meshStandardMaterial {...RIG_FRAME} />
      </RoundedBox>

      {/* Weight stack: guide rods + plates + moving selector pin */}
      {[-0.12, 0.12].map((x) => (
        <mesh key={x} position={[stackX + x, (STACK_BASE_Y + stackTop) / 2 + 0.12, stackZ]} castShadow>
          <cylinderGeometry args={[0.008, 0.008, stackTop - STACK_BASE_Y + 0.5, 12]} />
          <meshStandardMaterial {...STEEL} roughness={0.3} />
        </mesh>
      ))}
      {Array.from({ length: STACK_PLATES }, (_, i) => {
        const y = STACK_BASE_Y + i * (STACK_PLATE_H + STACK_GAP) + STACK_PLATE_H / 2;
        return (
          <RoundedBox
            key={i}
            args={[0.4, STACK_PLATE_H, 0.14]}
            radius={0.006}
            smoothness={2}
            position={[stackX, y, stackZ]}
          >
            <meshStandardMaterial
              color="#26282d"
              metalness={0.75}
              roughness={0.38}
              envMapIntensity={1.1}
            />
          </RoundedBox>
        );
      })}
      {/* Selector pin: bright steel with a grab knob, at the working plate */}
      <group position={[stackX, pinY, stackZ + 0.09]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.011, 0.011, 0.09, 16]} />
          <meshStandardMaterial {...STEEL} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.055]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.025, 20]} />
          <meshStandardMaterial color="#e6e8ee" metalness={0.6} roughness={0.35} />
        </mesh>
      </group>

      {/* Top pulley + cable down to the bar */}
      <mesh position={[0, 2.22, stackZ + 0.88]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.04, 28]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
      <mesh
        position={[0, (2.2 + barY) / 2, stackZ + 0.88]}
      >
        <cylinderGeometry args={[0.004, 0.004, 2.2 - barY, 8]} />
        <meshStandardMaterial color="#0e0f12" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Carabiner block */}
      <RoundedBox
        args={[0.05, 0.07, 0.04]}
        radius={0.008}
        smoothness={4}
        position={[0, barY - 0.02, stackZ + 0.88]}
      >
        <meshStandardMaterial {...STEEL} roughness={0.3} />
      </RoundedBox>

      {/* Cambered pulldown bar: straight center, angled ends, rubber grips */}
      <group position={[0, barY - 0.07, stackZ + 0.88]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.014, 0.014, 0.72, 24]} />
          <meshStandardMaterial {...STEEL} roughness={0.25} />
        </mesh>
        {[1, -1].map((s) => (
          <group key={s} position={[s * 0.36, 0, 0]} rotation={[0, 0, s * -0.5]}>
            <mesh position={[s * 0.17, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.014, 0.014, 0.34, 24]} />
              <meshStandardMaterial {...STEEL} roughness={0.25} />
            </mesh>
            {/* Rubber grip on the outer half */}
            <mesh position={[s * 0.26, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.017, 0.017, 0.15, 20]} />
              <meshStandardMaterial color="#1a1b1f" metalness={0.05} roughness={0.9} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Seat + thigh pads, facing the stack */}
      <RoundedBox
        args={[0.42, 0.07, 0.4]}
        radius={0.015}
        smoothness={4}
        position={[0, 0.46, stackZ + 0.95]}
        castShadow
      >
        <meshStandardMaterial color="#101216" roughness={0.95} envMapIntensity={0.3} />
      </RoundedBox>
      <RoundedBox
        args={[0.09, 0.42, 0.09]}
        radius={0.008}
        smoothness={4}
        position={[0, 0.22, stackZ + 0.95]}
        castShadow
      >
        <meshStandardMaterial {...RIG_FRAME} />
      </RoundedBox>
      {/* Thigh pad roller (full width, tucks the knees under) */}
      <mesh position={[0, 0.76, stackZ + 0.78]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.062, 0.062, 0.4, 28]} />
        <meshStandardMaterial color="#101216" roughness={0.95} envMapIntensity={0.3} />
      </mesh>
      <RoundedBox
        args={[0.06, 0.5, 0.06]}
        radius={0.006}
        smoothness={4}
        position={[0, 0.55, stackZ + 0.78]}
        castShadow
      >
        <meshStandardMaterial {...DARK_STEEL} />
      </RoundedBox>
    </group>
  );
}
