"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { gsap } from "gsap";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { SceneKind } from "@/lib/types";
import { barSpecFor, type PlateSolution, type PlateSpec } from "@/lib/plates/solve";
import { Barbell, largestPlateRadius } from "./Barbell";
import { glowIntensityFor, isCriticalLoad } from "./materials";
import {
  BeltPlate,
  BenchStation,
  DeadliftPlatform,
  DipStation,
  DumbbellStation,
  Floor,
  LatPulldownMachine,
  PLATFORM_TOP,
  PullupRig,
  SquatRack,
} from "./Equipment";
import { GoldArc, PRBurst } from "./PRBurst";

/** Per-lift choreography profile: where the bar lives and how a rep moves. */
interface SceneProfile {
  restY: number;
  repBottomY: number;
  repTopY: number;
  /** Z of the rack plane the bar rests in (0 = open floor). */
  restZ: number;
  /** Z the bar moves to for the working reps (unrack walk-out / over chest). */
  repZ: number;
  /** Bar whip amplitude factor (deadlift pulls). */
  whip: number;
  camera: { position: [number, number, number]; target: [number, number, number] };
  barbell: boolean;
}

/** Greedy denominated plates for a TOTAL display-unit load (belt chains). */
function denominate(total: number, solution: PlateSolution): PlateSpec[] {
  const denoms = barSpecFor(solution.unit).plates;
  const out: PlateSpec[] = [];
  let remaining = Math.round(total * 1000) / 1000;
  for (const plate of denoms) {
    while (remaining >= plate.value - 1e-6 && out.length < 8) {
      out.push(plate);
      remaining -= plate.value;
    }
  }
  return out;
}

function profileFor(kind: SceneKind, solution: PlateSolution): SceneProfile {
  const plateR = largestPlateRadius(solution);
  switch (kind) {
    case "bench":
      return {
        restY: 1.08,
        repBottomY: 0.78,
        repTopY: 1.12,
        restZ: -0.18,
        repZ: 0.2,
        whip: 0,
        camera: { position: [-1.35, 1.0, 1.85], target: [0, 0.88, 0] },
        barbell: true,
      };
    case "squat":
      return {
        restY: 1.5,
        repBottomY: 1.02,
        repTopY: 1.52,
        restZ: -0.25,
        repZ: 0.2,
        whip: 0,
        camera: { position: [-1.5, 1.4, 2.05], target: [0, 1.28, 0] },
        barbell: true,
      };
    case "deadlift":
      return {
        restY: PLATFORM_TOP + plateR,
        repBottomY: PLATFORM_TOP + plateR,
        repTopY: 0.88,
        restZ: 0,
        repZ: 0,
        whip: 1,
        camera: { position: [-1.45, 0.78, 1.9], target: [0, 0.5, 0] },
        barbell: true,
      };
    case "ohp":
      return {
        restY: 1.42,
        repBottomY: 1.42,
        repTopY: 2.06,
        restZ: -0.25,
        repZ: 0.2,
        whip: 0,
        camera: { position: [-1.5, 1.62, 2.05], target: [0, 1.6, 0] },
        barbell: true,
      };
    case "row":
      return {
        restY: PLATFORM_TOP + plateR,
        repBottomY: PLATFORM_TOP + plateR,
        repTopY: PLATFORM_TOP + plateR + 0.32,
        restZ: 0,
        repZ: 0,
        whip: 0,
        camera: { position: [-1.35, 0.82, 1.85], target: [0, 0.55, 0] },
        barbell: true,
      };
    case "pullup":
      return {
        restY: 0,
        repBottomY: 0,
        repTopY: 0,
        restZ: 0,
        repZ: 0,
        whip: 0,
        camera: { position: [-1.75, 1.6, 2.9], target: [0, 1.15, 0] },
        barbell: false,
      };
    case "dip":
      return {
        restY: 0,
        repBottomY: 0,
        repTopY: 0,
        restZ: 0,
        repZ: 0,
        whip: 0,
        camera: { position: [-1.1, 1.22, 1.65], target: [0, 1.0, 0] },
        barbell: false,
      };
    case "dumbbell":
      return {
        restY: 0,
        repBottomY: 0,
        repTopY: 0,
        restZ: 0,
        repZ: 0,
        whip: 0,
        camera: { position: [-1.3, 1.1, 1.8], target: [0, 0.72, 0] },
        barbell: false,
      };
    case "latpulldown":
      return {
        restY: 0,
        repBottomY: 0,
        repTopY: 0,
        restZ: 0,
        repZ: 0,
        whip: 0,
        camera: { position: [-1.75, 1.5, 2.1], target: [0.05, 1.15, -0.15] },
        barbell: false,
      };
    case "generic-bar":
      return {
        restY: 1.0,
        repBottomY: 0.7,
        repTopY: 1.02,
        restZ: -0.25,
        repZ: 0.2,
        whip: 0,
        camera: { position: [-1.45, 1.02, 1.9], target: [0, 0.9, 0] },
        barbell: true,
      };
  }
}

/**
 * Load-reactive key light: intensity scales with load ÷ e1RM (calm at light
 * loads, near-critical pulse at ≥90%), and the set-save ripple flares it.
 * The photographic replacement for the retired emissive plate rims.
 */
function LoadLight({
  e1rmFraction,
  rippleBoost,
  reducedMotion,
}: {
  e1rmFraction: number | null;
  rippleBoost: React.RefObject<number>;
  reducedMotion: boolean;
}) {
  const light = useRef<THREE.SpotLight>(null);
  const base = glowIntensityFor(e1rmFraction);
  const critical = isCriticalLoad(e1rmFraction);
  useFrame(({ clock }) => {
    if (!light.current) return;
    const t = clock.getElapsedTime();
    const pulse = reducedMotion
      ? 1
      : critical
        ? 0.72 + 0.28 * Math.abs(Math.sin(t * 2.6))
        : 0.92 + 0.08 * Math.sin(t * 1.1);
    light.current.intensity =
      6 + base * 13 * pulse + (rippleBoost.current ?? 0) * 30;
  });
  return (
    <spotLight
      ref={light}
      position={[0.4, 3.4, 1.4]}
      angle={0.4}
      penumbra={1}
      distance={10}
      color="#ffffff"
      intensity={10}
    />
  );
}

export interface LiftSceneProps {
  kind: SceneKind;
  solution: PlateSolution;
  e1rmFraction: number | null;
  /** Bump to play the rep animation + energy ripple (set save). */
  animateToken: number;
  /** Bump to fire the PR celebration. Fires ONLY on genuine PRs. */
  prToken: number;
  /** Visual rep count for the animation (capped internally). */
  reps: number;
  /** kg on the belt for bodyweight lifts (negative = assisted). */
  addedWeightKg?: number;
  /** Entered weight in the DISPLAY unit (drives dumbbell/stack scenes). */
  displayLoad?: number;
  reducedMotion: boolean;
  /** Enables depth of field (desktop-tier GPUs only). */
  highTier: boolean;
}

function CameraRig({
  profile,
  reducedMotion,
  animateToken,
}: {
  profile: SceneProfile;
  reducedMotion: boolean;
  animateToken: number;
}) {
  const { camera } = useThree();
  const basePosition = useRef(new THREE.Vector3(...profile.camera.position));
  const push = useRef({ value: 0 });
  const target = useMemo(
    () => new THREE.Vector3(...profile.camera.target),
    [profile],
  );

  useEffect(() => {
    basePosition.current.set(...profile.camera.position);
    camera.position.copy(basePosition.current);
    camera.lookAt(target);
  }, [camera, profile, target]);

  // Camera micro-push on set save.
  useEffect(() => {
    if (animateToken <= 0 || reducedMotion) return;
    const tween = gsap.timeline();
    tween
      .to(push.current, { value: 1, duration: 0.18, ease: "power2.out" })
      .to(push.current, { value: 0, duration: 0.7, ease: "power2.inOut" });
    return () => {
      tween.kill();
    };
  }, [animateToken, reducedMotion]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const drift = reducedMotion ? 0 : Math.sin(t * 0.22) * 0.06;
    const bob = reducedMotion ? 0 : Math.sin(t * 0.3) * 0.02;
    const dir = basePosition.current.clone().sub(target).normalize();
    camera.position
      .copy(basePosition.current)
      .addScaledVector(dir, -0.16 * push.current.value)
      .add(new THREE.Vector3(drift, bob, 0));
    camera.lookAt(target);
  });

  return null;
}

function BarAnimator({
  profile,
  animateToken,
  reps,
  reducedMotion,
  loadFraction,
  children,
}: {
  profile: SceneProfile;
  animateToken: number;
  reps: number;
  reducedMotion: boolean;
  loadFraction: number;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const pose = useRef({ y: profile.restY, z: profile.restZ, whip: 0 });

  useEffect(() => {
    pose.current.y = profile.restY;
    pose.current.z = profile.restZ;
  }, [profile]);

  useEffect(() => {
    if (animateToken <= 0 || reducedMotion) return;
    const visualReps = Math.max(1, Math.min(4, Math.round(reps)));
    const tl = gsap.timeline();
    const isPull = profile.repTopY > profile.restY + 0.01; // deadlift/ohp/row start low
    // Unrack: lift slightly and walk the bar out of the rack plane.
    if (Math.abs(profile.repZ - profile.restZ) > 0.01) {
      tl.to(pose.current, {
        y: profile.restY + 0.04,
        duration: 0.22,
        ease: "power2.out",
      }).to(pose.current, {
        z: profile.repZ,
        duration: 0.4,
        ease: "power2.inOut",
      });
    }
    for (let i = 0; i < visualReps; i++) {
      if (isPull) {
        tl.to(pose.current, {
          y: profile.repTopY,
          duration: 0.55,
          ease: "power3.out",
        });
        if (profile.whip > 0) {
          tl.to(
            pose.current,
            {
              whip: 0.028 * Math.min(1.4, 0.5 + loadFraction),
              duration: 0.16,
              ease: "power2.out",
            },
            "<",
          ).to(pose.current, {
            whip: 0,
            duration: 0.6,
            ease: "elastic.out(1.4, 0.22)",
          });
        }
        tl.to(pose.current, {
          y: profile.repBottomY,
          duration: 0.5,
          ease: "power2.in",
        });
      } else {
        tl.to(pose.current, {
          y: profile.repBottomY,
          duration: 0.5,
          ease: "power2.inOut",
        }).to(pose.current, {
          y: profile.repTopY,
          duration: 0.55,
          ease: "power3.out",
        });
      }
    }
    // Re-rack.
    if (Math.abs(profile.repZ - profile.restZ) > 0.01) {
      tl.to(pose.current, {
        y: profile.restY + 0.04,
        duration: 0.3,
        ease: "power2.inOut",
      })
        .to(pose.current, {
          z: profile.restZ,
          duration: 0.4,
          ease: "power2.inOut",
        })
        .to(pose.current, { y: profile.restY, duration: 0.2, ease: "power2.in" });
    } else {
      tl.to(pose.current, { y: profile.restY, duration: 0.45, ease: "power2.inOut" });
    }
    const activePose = pose.current;
    return () => {
      tl.kill();
      activePose.y = profile.restY;
      activePose.z = profile.restZ;
      activePose.whip = 0;
    };
  }, [animateToken, profile, reps, reducedMotion, loadFraction]);

  useFrame(() => {
    if (!group.current) return;
    group.current.position.y = pose.current.y;
    group.current.position.z = pose.current.z;
    group.current.rotation.z = pose.current.whip;
  });

  return <group ref={group}>{children}</group>;
}

/** Neutral studio lighting: monochrome, crisp, no colored washes. */
function ForgeLighting({ highTier }: { highTier: boolean }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2.6, 4.2, 2.4]} intensity={1.1} />
      {/* Front fill */}
      <pointLight position={[-1.8, 2.2, 2.6]} intensity={5} color="#ffffff" distance={9} />
      {/* Rim light from behind-left: draws the silhouette out of the dark */}
      <directionalLight position={[-3, 2.4, -2.6]} intensity={3} color="#eef1f7" />
      {/* Backdrop pool: soft gradient on the cove behind the equipment */}
      <pointLight position={[0, 1.8, -5.4]} intensity={7} color="#b9bec8" distance={10} />
      {/* Procedural HDRI stand-in: offline-safe metallic reflections. */}
      <Environment resolution={highTier ? 256 : 128} frames={1}>
        {/* Car-studio light tunnel: long overhead strip + angled sides. */}
        <Lightformer
          intensity={3}
          position={[0, 4, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[8, 1.6, 1]}
          color="#ffffff"
        />
        <Lightformer
          intensity={1.2}
          position={[0, 2.6, -4]}
          scale={[7, 1.2, 1]}
          color="#f2f3f6"
        />
        <Lightformer
          intensity={1}
          position={[-4, 1.8, 1]}
          rotation={[0, Math.PI / 3, 0]}
          scale={[3, 0.8, 1]}
          color="#e9eaef"
        />
        <Lightformer
          intensity={0.7}
          position={[4, 1.6, 1]}
          rotation={[0, -Math.PI / 3, 0]}
          scale={[2.6, 0.7, 1]}
          color="#c9c9d2"
        />
        <Lightformer
          intensity={0.35}
          position={[0, -2, 3]}
          scale={[9, 1, 1]}
          color="#3a3a42"
        />
      </Environment>
    </>
  );
}

/** The full per-lift 3D stage. Mount via SceneViewport (lazy). */
export default function LiftScene(props: LiftSceneProps) {
  const {
    kind,
    solution,
    e1rmFraction,
    animateToken,
    prToken,
    reps,
    addedWeightKg = 0,
    displayLoad = 0,
    reducedMotion,
    highTier,
  } = props;
  const profile = useMemo(() => profileFor(kind, solution), [kind, solution]);
  // Display-unit load normalized to lb for the rack-position thresholds.
  const loadLb =
    solution.unit === "kg" ? displayLoad * 2.20462262 : displayLoad;
  // Belt chains carry the TOTAL added load as real denominated plates.
  const beltPlates = useMemo(() => {
    const addedDisplay =
      Math.abs(addedWeightKg) * (solution.unit === "kg" ? 1 : 2.20462262);
    return denominate(addedDisplay, solution);
  }, [addedWeightKg, solution]);
  const rippleBoost = useRef(0);
  const rippleProxy = useRef({ value: 0 });

  // Energy ripple along the bar on set save.
  useEffect(() => {
    if (animateToken <= 0 || reducedMotion) return;
    const tl = gsap.timeline();
    tl.to(rippleProxy.current, {
      value: 1,
      duration: 0.16,
      ease: "power3.out",
      onUpdate: () => {
        rippleBoost.current = rippleProxy.current.value;
      },
    }).to(rippleProxy.current, {
      value: 0,
      duration: 0.9,
      ease: "power2.out",
      onUpdate: () => {
        rippleBoost.current = rippleProxy.current.value;
      },
    });
    return () => {
      tl.kill();
      rippleBoost.current = 0;
    };
  }, [animateToken, reducedMotion]);

  const burstOrigin: [number, number, number] = [
    0,
    profile.barbell ? (profile.restY + profile.repTopY) / 2 : 1.6,
    0,
  ];

  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={reducedMotion ? "demand" : "always"}
      gl={{ powerPreference: "high-performance", antialias: true }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.35;
      }}
      camera={{ fov: 42, near: 0.1, far: 40 }}
      className="!touch-none"
    >
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 7, 17]} />
      <ForgeLighting highTier={highTier} />
      <LoadLight
        e1rmFraction={e1rmFraction}
        rippleBoost={rippleBoost}
        reducedMotion={reducedMotion}
      />
      <CameraRig
        profile={profile}
        reducedMotion={reducedMotion}
        animateToken={animateToken}
      />
      <Floor highTier={highTier} />

      {profile.barbell ? (
        <>
          {kind === "bench" ? <BenchStation barY={profile.restY} /> : null}
          {kind === "row" || kind === "deadlift" ? <DeadliftPlatform /> : null}
          {kind === "squat" ? <SquatRack barY={profile.restY} /> : null}
          {kind === "ohp" || kind === "generic-bar" ? (
            <SquatRack barY={profile.restY} />
          ) : null}
          <BarAnimator
            profile={profile}
            animateToken={animateToken}
            reps={reps}
            reducedMotion={reducedMotion}
            loadFraction={e1rmFraction ?? 0.5}
          >
            <Barbell solution={solution} />
          </BarAnimator>
        </>
      ) : kind === "dumbbell" ? (
        <DumbbellStation weightLb={loadLb} />
      ) : kind === "latpulldown" ? (
        <LatPulldownMachine weightLb={loadLb} />
      ) : (
        <>
          {kind === "pullup" ? <PullupRig /> : <DipStation />}
          <BeltPlate
            visible={Math.abs(addedWeightKg) > 0.01}
            assisted={addedWeightKg < 0}
            plates={beltPlates}
            barY={kind === "pullup" ? 2.2 : 1.25}
            stackPos={kind === "pullup" ? [0.45, 0.4] : [0.62, 0.18]}
          />
        </>
      )}

      {!reducedMotion ? (
        <>
          <PRBurst trigger={prToken} origin={burstOrigin} />
          <GoldArc trigger={prToken} origin={burstOrigin} />
        </>
      ) : null}

      {/* Subtle finishing pass: sparkle on blown chrome highlights and a
          gentle edge falloff. No depth of field — sharpness is sacred. */}
      <EffectComposer multisampling={highTier ? 4 : 0}>
        <Bloom
          mipmapBlur
          intensity={0.45}
          luminanceThreshold={1}
          luminanceSmoothing={0.2}
        />
        <Vignette eskil={false} offset={0.25} darkness={0.62} />
      </EffectComposer>
    </Canvas>
  );
}
