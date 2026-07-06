"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const COUNT = 420;
const LIFE = 1.7; // seconds

let spriteTexture: THREE.CanvasTexture | null = null;
function getSpriteTexture(): THREE.CanvasTexture {
  if (spriteTexture) return spriteTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,236,179,1)");
  g.addColorStop(0.35, "rgba(251,191,36,0.9)");
  g.addColorStop(1, "rgba(251,191,36,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  spriteTexture = new THREE.CanvasTexture(canvas);
  return spriteTexture;
}

/**
 * Pooled particle system: one geometry, one persistent velocity buffer,
 * zero allocations per frame. Class-encapsulated so the imperative
 * integration stays out of React's render path entirely.
 */
class BurstPool {
  readonly geometry: THREE.BufferGeometry;
  private readonly velocities = new Float32Array(COUNT * 3);
  private startedAt = -1;
  active = false;

  constructor() {
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3),
    );
  }

  arm(origin: [number, number, number]): void {
    const pos = this.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = origin[0] + (Math.random() - 0.5) * 1.15; // along the bar
      pos[i * 3 + 1] = origin[1];
      pos[i * 3 + 2] = origin[2] + (Math.random() - 0.5) * 0.08;
      const theta = Math.random() * Math.PI * 2;
      const up = 1.4 + Math.random() * 2.3;
      const radial = 0.25 + Math.random() * 1.15;
      this.velocities[i * 3] = Math.cos(theta) * radial;
      this.velocities[i * 3 + 1] = up;
      this.velocities[i * 3 + 2] = Math.sin(theta) * radial * 0.6;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.startedAt = performance.now() / 1000;
    this.active = true;
  }

  /** Integrate one frame; returns opacity, or null when the burst ends. */
  tick(delta: number): number | null {
    if (!this.active) return null;
    const age = performance.now() / 1000 - this.startedAt;
    if (age > LIFE) {
      this.active = false;
      return null;
    }
    const dt = Math.min(delta, 0.05);
    const pos = this.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      this.velocities[i * 3 + 1] -= 3.4 * dt; // gravity
      pos[i * 3] += this.velocities[i * 3] * dt;
      pos[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      pos[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
    }
    this.geometry.attributes.position.needsUpdate = true;
    return 1 - (age / LIFE) ** 1.6;
  }

  dispose(): void {
    this.geometry.dispose();
  }
}

/** Gold PR particle burst. Reserved for genuine PRs only. */
export function PRBurst({
  trigger,
  origin,
}: {
  /** Increment to fire a burst; 0 = never fired. */
  trigger: number;
  origin: [number, number, number];
}) {
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.PointsMaterial>(null);
  const [pool] = useState(() => new BurstPool());

  useEffect(() => () => pool.dispose(), [pool]);

  useEffect(() => {
    if (trigger <= 0) return;
    pool.arm(origin);
    if (points.current) points.current.visible = true;
  }, [trigger, origin, pool]);

  useFrame((_, delta) => {
    if (!points.current || !material.current) return;
    const opacity = pool.tick(delta);
    if (opacity === null) {
      points.current.visible = false;
      return;
    }
    material.current.opacity = opacity;
  });

  return (
    <points ref={points} visible={false} geometry={pool.geometry} frustumCulled={false}>
      <pointsMaterial
        ref={material}
        map={getSpriteTexture()}
        color="#ffd76a"
        size={0.055}
        sizeAttenuation
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

/** Expanding gold arc ring that accompanies the burst. */
export function GoldArc({
  trigger,
  origin,
}: {
  trigger: number;
  origin: [number, number, number];
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const startedAt = useRef(-1);

  useEffect(() => {
    if (trigger <= 0) return;
    startedAt.current = performance.now() / 1000;
    if (mesh.current) mesh.current.visible = true;
  }, [trigger]);

  useFrame(() => {
    if (startedAt.current < 0 || !mesh.current || !material.current) return;
    const age = performance.now() / 1000 - startedAt.current;
    const duration = 0.9;
    if (age > duration) {
      mesh.current.visible = false;
      startedAt.current = -1;
      return;
    }
    const t = age / duration;
    mesh.current.scale.setScalar(0.3 + t * 2.6);
    material.current.opacity = (1 - t) * 0.85;
  });

  return (
    <mesh ref={mesh} visible={false} position={origin} rotation={[Math.PI / 2.6, 0, 0]}>
      <torusGeometry args={[0.5, 0.012, 8, 72]} />
      <meshBasicMaterial
        ref={material}
        color="#fbbf24"
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}
