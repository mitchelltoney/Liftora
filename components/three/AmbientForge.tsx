"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/** Aim the camera into the forge so the core anchors the composition. */
function CameraAim() {
  const { camera } = useThree();
  useEffect(() => {
    camera.lookAt(0, 1.05, -6.5);
  }, [camera]);
  return null;
}

let horizonTexture: THREE.CanvasTexture | null = null;
/** Soft-edged ember gradient so the horizon reads as glow, not a slab. */
function getHorizonTexture(): THREE.CanvasTexture {
  if (horizonTexture) return horizonTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.45, "rgba(255,255,255,0.30)");
  g.addColorStop(0.75, "rgba(255,255,255,0.14)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 128);
  horizonTexture = new THREE.CanvasTexture(canvas);
  return horizonTexture;
}

/**
 * The Home Nexus ambient: a distant forge — obsidian pillars in haze, slow
 * cyan energy arcs, drifting embers, floating holo panels with pointer
 * parallax. Cheap by construction: ~40 draw calls, no shadows, no assets.
 */

function Pillars() {
  const pillars = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        x: -8 + i * 2 + (i % 2 ? 0.5 : -0.4),
        z: -6 - (i % 3) * 3.2,
        h: 5 + (i % 4) * 2.4,
        w: 0.7 + (i % 3) * 0.35,
      })),
    [],
  );
  return (
    <group>
      {pillars.map((p, i) => (
        <mesh key={i} position={[p.x, p.h / 2 - 1.5, p.z]}>
          <boxGeometry args={[p.w, p.h, p.w]} />
          <meshStandardMaterial color="#101013" metalness={0.4} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/** The molten heart of the forge: a bloom-fed core with orbiting arcs. */
function ForgeCore() {
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = 1 + Math.sin(t * 0.8) * 0.08;
    core.current?.scale.setScalar(pulse);
    halo.current?.scale.setScalar(1.35 + Math.sin(t * 0.5) * 0.1);
  });
  return (
    <group position={[0, 1.35, -6.5]}>
      <mesh ref={core}>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh ref={halo}>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.28}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function EnergyArcs() {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    group.current.children.forEach((child, i) => {
      child.rotation.z = t * (0.08 + i * 0.03) * (i % 2 ? 1 : -1);
    });
  });
  return (
    <group ref={group} position={[0, 1.35, -6.5]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} rotation={[Math.PI / 2.2 - i * 0.35, i * 0.6, 0]}>
          <torusGeometry args={[1.1 + i * 0.65, 0.012, 6, 90, Math.PI * 1.35]} />
          <meshBasicMaterial
            color={i === 1 ? "#9a9aa2" : "#ffffff"}
            transparent
            opacity={0.85 - i * 0.18}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

const EMBER_COUNT = 180;

/** Drifting haze embers, class-encapsulated (no allocations per frame). */
class EmberField {
  readonly geometry: THREE.BufferGeometry;
  private readonly seeds: Float32Array;

  constructor() {
    this.seeds = new Float32Array(EMBER_COUNT * 3);
    for (let i = 0; i < EMBER_COUNT; i++) {
      this.seeds[i * 3] = (Math.random() - 0.5) * 16;
      this.seeds[i * 3 + 1] = Math.random() * 7 - 1;
      this.seeds[i * 3 + 2] = -2 - Math.random() * 10;
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.seeds.slice(), 3),
    );
  }

  tick(t: number): void {
    const pos = this.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < EMBER_COUNT; i++) {
      pos[i * 3 + 1] =
        this.seeds[i * 3 + 1] +
        Math.sin(t * 0.25 + i) * 0.35 +
        ((t * 0.06 + i * 0.13) % 7) * 0.12;
      pos[i * 3] = this.seeds[i * 3] + Math.sin(t * 0.1 + i * 2.1) * 0.2;
    }
    this.geometry.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
  }
}

function Embers({ reducedMotion }: { reducedMotion: boolean }) {
  const [field] = useState(() => new EmberField());
  useEffect(() => () => field.dispose(), [field]);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    field.tick(clock.getElapsedTime());
  });

  return (
    <points geometry={field.geometry} frustumCulled={false}>
      <pointsMaterial
        color="#ffffff"
        size={0.05}
        sizeAttenuation
        transparent
        opacity={0.45}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

function HoloPanels({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const panels = useMemo(
    () => [
      { pos: [-2.3, 1.0, -3.4] as const, size: [1.1, 0.65] as const, tilt: 0.35 },
      { pos: [2.5, 1.7, -4.2] as const, size: [0.9, 0.55] as const, tilt: -0.3 },
      { pos: [1.4, 0.6, -3.0] as const, size: [0.8, 0.5] as const, tilt: -0.15 },
    ],
    [],
  );

  useFrame(({ pointer, clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    const px = reducedMotion ? 0 : pointer.x;
    const py = reducedMotion ? 0 : pointer.y;
    group.current.position.x = px * 0.25;
    group.current.position.y = py * 0.15;
    group.current.children.forEach((child, i) => {
      if (!reducedMotion) {
        child.position.y = panels[i].pos[1] + Math.sin(t * 0.5 + i * 2) * 0.06;
      }
    });
  });

  return (
    <group ref={group}>
      {panels.map((p, i) => (
        <group key={i} position={[...p.pos]} rotation={[0, p.tilt, 0]}>
          <mesh>
            <planeGeometry args={[...p.size]} />
            <meshBasicMaterial
              color="#161618"
              transparent
              opacity={0.6}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.PlaneGeometry(...p.size)]} />
            <lineBasicMaterial color="#ffffff" transparent opacity={0.45} toneMapped={false} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

export default function AmbientForge({
  reducedMotion,
}: {
  reducedMotion: boolean;
}) {
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={reducedMotion ? "demand" : "always"}
      gl={{ powerPreference: "high-performance", antialias: true }}
      camera={{ position: [0, 1.6, 4.2], fov: 50, near: 0.1, far: 60 }}
    >
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 6, 18]} />
      <ambientLight intensity={0.45} />
      <pointLight position={[0, 1.6, -6]} intensity={22} color="#ffffff" distance={16} />
      <pointLight position={[-4, 1, -6]} intensity={4} color="#c9c9d2" distance={11} />
      <pointLight position={[0, 2.5, 2]} intensity={5} color="#ffffff" distance={10} />
      <CameraAim />
      {/* Ember-orange horizon glow behind the pillars */}
      <mesh position={[0, -0.4, -12]}>
        <planeGeometry args={[34, 5.5]} />
        <meshBasicMaterial
          map={getHorizonTexture()}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* Light pool beneath the core */}
      <mesh position={[0, -1.48, -6.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.6, 40]} />
        <meshBasicMaterial
          color="#3a3a40"
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <gridHelper
        args={[40, 56, new THREE.Color("#26262b"), new THREE.Color("#121214")]}
        position={[0, -1.49, 0]}
      />
      <Pillars />
      <ForgeCore />
      <EnergyArcs />
      <Embers reducedMotion={reducedMotion} />
      <HoloPanels reducedMotion={reducedMotion} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0a0a0b" metalness={0.3} roughness={0.85} />
      </mesh>
    </Canvas>
  );
}
