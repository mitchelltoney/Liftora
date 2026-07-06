import * as THREE from "three";

/**
 * Shared, module-cached materials and procedural textures for the 3D rigs.
 * Everything is generated at runtime — zero downloaded assets, fully
 * offline-capable, and the whole "asset payload" is a few KB of code.
 */

let knurlTexture: THREE.CanvasTexture | null = null;

/** Procedural knurling normal map (diamond cross-hatch), tiled on the bar grip. */
export function getKnurlNormalMap(): THREE.CanvasTexture {
  if (knurlTexture) return knurlTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // Neutral normal (pointing out of the surface).
  ctx.fillStyle = "rgb(128,128,255)";
  ctx.fillRect(0, 0, size, size);
  // Diamond cross-hatch: two families of diagonal grooves.
  for (const [angle, light, dark] of [
    [Math.PI / 4, "rgba(170,150,255,0.9)", "rgba(90,105,255,0.9)"],
    [-Math.PI / 4, "rgba(150,170,255,0.9)", "rgba(105,90,255,0.9)"],
  ] as const) {
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(angle);
    ctx.translate(-size, -size);
    for (let i = 0; i < size * 4; i += 6) {
      ctx.fillStyle = light;
      ctx.fillRect(0, i, size * 2.83, 1.5);
      ctx.fillStyle = dark;
      ctx.fillRect(0, i + 1.5, size * 2.83, 1.5);
    }
    ctx.restore();
  }
  knurlTexture = new THREE.CanvasTexture(canvas);
  knurlTexture.wrapS = THREE.RepeatWrapping;
  knurlTexture.wrapT = THREE.RepeatWrapping;
  knurlTexture.repeat.set(14, 2);
  return knurlTexture;
}

let concreteRoughness: THREE.CanvasTexture | null = null;

/**
 * Procedural polished-concrete roughness map: blotchy patches + faint
 * directional streaks. Drives uneven, smudged floor reflections — the
 * difference between "CAD plane" and "real studio floor".
 */
export function getConcreteRoughnessMap(): THREE.CanvasTexture {
  if (concreteRoughness) return concreteRoughness;
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // Base: mid roughness.
  ctx.fillStyle = "rgb(150,150,150)";
  ctx.fillRect(0, 0, size, size);
  // Deterministic pseudo-random (no Math.random in module scope for SSR
  // determinism; seeded LCG).
  let seed = 1337;
  const rand = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  // Blotches: polished (dark = smooth) and scuffed (light = rough) patches.
  for (let i = 0; i < 260; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 14 + rand() * 90;
    const smooth = rand() > 0.45;
    const v = smooth ? 96 + rand() * 34 : 168 + rand() * 50;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${v},${v},${v},${0.16 + rand() * 0.2})`);
    g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Faint directional drag streaks.
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 70; i++) {
    const y = rand() * size;
    const v = 110 + rand() * 90;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, size, 1 + rand() * 2);
  }
  ctx.globalAlpha = 1;
  concreteRoughness = new THREE.CanvasTexture(canvas);
  concreteRoughness.wrapS = THREE.RepeatWrapping;
  concreteRoughness.wrapT = THREE.RepeatWrapping;
  concreteRoughness.repeat.set(3, 3);
  return concreteRoughness;
}

export const STEEL = {
  color: "#cdd0d6",
  metalness: 0.95,
  roughness: 0.26,
  envMapIntensity: 1.3,
} as const;

export const DARK_STEEL = {
  color: "#43474e",
  metalness: 0.85,
  roughness: 0.4,
  envMapIntensity: 1.1,
} as const;

export const RIG_FRAME = {
  color: "#141519",
  metalness: 0.5,
  roughness: 0.62,
  // Deep matte powder-coat: keep the environment out of it.
  envMapIntensity: 0.45,
} as const;

/**
 * Load-glow: emissive intensity as a function of load relative to e1RM.
 * ≤60% → calm shimmer, 90%+ → intense pulse (pulse applied in-frame).
 */
export function glowIntensityFor(e1rmFraction: number | null): number {
  if (e1rmFraction === null || !Number.isFinite(e1rmFraction)) return 0.35;
  const t = Math.min(1, Math.max(0, (e1rmFraction - 0.6) / 0.4));
  return 0.25 + t * 2.1;
}

/** Whether the load deserves the ≥90% "critical" pulse treatment. */
export function isCriticalLoad(e1rmFraction: number | null): boolean {
  return e1rmFraction !== null && e1rmFraction >= 0.9;
}
