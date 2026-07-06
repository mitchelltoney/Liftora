#!/usr/bin/env node
/**
 * Rasterizes the AetherForge emblem into every PWA icon size.
 * Run: node scripts/generate-icons.mjs   (re-run after editing the SVG)
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve(process.cwd(), "public/icons");

/** The emblem: a loaded bar over a forge arc, HUD brackets, cyan on #050810. */
function emblemSVG({ maskable = false } = {}) {
  // Maskable icons keep art inside the 80% safe zone.
  const pad = maskable ? 96 : 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="#0d1a2e"/>
      <stop offset="100%" stop-color="#050810"/>
    </radialGradient>
    <linearGradient id="arc" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#22d3ee" stop-opacity="0"/>
      <stop offset="50%" stop-color="#22d3ee"/>
      <stop offset="100%" stop-color="#e879f9" stop-opacity="0.6"/>
    </linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="7" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="512" height="512" rx="${maskable ? 0 : 96}" fill="url(#bg)"/>
  <g transform="translate(${pad},${pad}) scale(${(512 - pad * 2) / 432})">
    <!-- HUD corner brackets -->
    <g stroke="#22d3ee" stroke-width="7" fill="none" opacity="0.75">
      <path d="M8 48 V8 H48"/>
      <path d="M384 8 H424 V48"/>
      <path d="M424 384 V424 H384"/>
      <path d="M48 424 H8 V384"/>
    </g>
    <!-- Forge arc under the bar -->
    <path d="M60 300 A160 160 0 0 1 372 300" stroke="url(#arc)" stroke-width="10"
          fill="none" stroke-linecap="round" filter="url(#glow)"/>
    <!-- Barbell -->
    <g filter="url(#glow)">
      <rect x="36" y="204" width="360" height="16" rx="8" fill="#c9d4e3"/>
      <!-- plates: outer small, inner large, both sides -->
      <rect x="76"  y="146" width="26" height="132" rx="9" fill="#101d33" stroke="#22d3ee" stroke-width="6"/>
      <rect x="110" y="166" width="20" height="92"  rx="8" fill="#101d33" stroke="#22d3ee" stroke-width="5"/>
      <rect x="330" y="146" width="26" height="132" rx="9" fill="#101d33" stroke="#22d3ee" stroke-width="6"/>
      <rect x="302" y="166" width="20" height="92"  rx="8" fill="#101d33" stroke="#22d3ee" stroke-width="5"/>
    </g>
    <!-- Ignition spark -->
    <circle cx="216" cy="212" r="10" fill="#a5f3fc" filter="url(#glow)"/>
  </g>
</svg>`;
}

await mkdir(OUT, { recursive: true });
const standard = Buffer.from(emblemSVG());
const maskable = Buffer.from(emblemSVG({ maskable: true }));

const jobs = [
  { src: standard, size: 192, name: "icon-192.png" },
  { src: standard, size: 512, name: "icon-512.png" },
  { src: standard, size: 180, name: "apple-touch-icon.png" },
  { src: maskable, size: 192, name: "maskable-192.png" },
  { src: maskable, size: 512, name: "maskable-512.png" },
];

for (const job of jobs) {
  await sharp(job.src).resize(job.size, job.size).png().toFile(path.join(OUT, job.name));
  console.log(`✓ ${job.name}`);
}
await writeFile(path.join(OUT, "emblem.svg"), emblemSVG());
console.log("✓ emblem.svg");
