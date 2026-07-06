# Liftora

A training command center for serious lifters. Sleek, monochrome, iOS-
inspired design on true black; local-first fitness tracking PWA with
physically-accurate, reactive 3D workout visualization: every logged set
renders the barbell loaded with the exact plates the weight implies, and
genuine PRs earn a gold particle celebration.

## Features

- **Quick Session Logger** — oversized thumb-first steppers (weight/reps/RPE
  in 0.5 steps), one-tap repeat-last-set, drag-to-reorder set list, per-set
  auto-starting rest timer, live session clock. In-progress sessions persist
  to IndexedDB and survive accidental closes/reloads.
- **Reactive 3D scenes (Three.js / R3F)** — per-lift stages for Bench, Squat,
  Deadlift, Overhead Press, Row (loaded barbell + equipment with real rep
  choreography: unrack, reps, re-rack, deadlift bar whip) and holographic
  rigs for Pull-Ups/Dips with a glowing belt plate for added/assisted load.
  Plate emissive glow scales with % of your e1RM; ≥90% pulses. PRs fire a
  pooled GPU particle burst + gold arc + a GSAP HUD flourish — and only
  genuine PRs.
- **Exact plate math** — greedy solver over standard lb (45 bar) and
  competition kg (20 bar, IPF colors) sets; non-loadable weights show the
  nearest loadable total; sub-bar weights warn.
- **Session debrief** — duration, volume (bodyweight-aware), top sets,
  Epley e1RM (Brzycki on tap, rep-capped at 12 with low-confidence flags),
  PR banner with deltas.
- **History & Analytics** — 26-week training heatmap, gold PR timeline,
  filterable session archive; per-lift e1RM trend, top-set trend, weekly
  volume, RPE distribution — hand-rolled accessible SVG charts with data
  table fallbacks; filters for lift, date range, rep range.
- **Streaks** — gold weekly streak (consecutive weeks at your configured
  session target) + raw day chain, labeled distinctly.
- **Installable offline PWA** — service worker precaches the app shell and
  route chunks; the whole flow works with no network.
- **Your data is never trapped** — lossless JSON export/import of the entire
  database. Labeled demo data seeds on first run; one tap clears it.

## Requirements

- Node.js 20.9 or newer (tested on Node 26)
- npm 10 or newer

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Production

```bash
npm run build
npm run start
```

The service worker (offline support) registers in production builds only.

## Quality checks

```bash
npm run test        # Vitest: plate solver, e1RM, volume, PRs, streaks, DB round-trips
npm run typecheck   # tsc --noEmit (strict)
npm run lint        # eslint
npm run build       # next build
```

## Verification harnesses (optional, used in the iteration protocol)

```bash
npm run start &                                   # serve production on :3000
node scripts/bundle-size.mjs http://localhost:3000
node scripts/offline-test.mjs http://localhost:3000
node scripts/audit.mjs http://localhost:3000 ./audit-shots --gpu
node scripts/frame-cost.mjs http://localhost:3000
node scripts/generate-icons.mjs                   # regenerate PWA icons from the SVG emblem
```

(The Playwright harnesses need `npx playwright install chromium` once.)

## Project structure

```
app/                    Routes (App Router). Non-3D routes stay <250 KB gz.
  page.tsx              Home Nexus (ambient forge scene, streaks, quick log CTA)
  log/                  Quick Session Logger
  summary/[sessionId]/  Session debrief + PR celebration
  history/              Heatmap, PR timeline, session archive
  analytics/            Progression charts
  settings/             Units, bodyweight, targets, motion, export/import, demo data
components/
  hud/                  Design-system components: dock nav, glass panels,
                        steppers, timers, charts, PR flourish
  three/                All 3D: barbell rig, equipment, lift scenes, ambient
                        forge, pooled particles (lazy-loaded, zero assets)
  screens/              Screen implementations
  ui/                   shadcn/ui primitives
lib/
  analytics/            Pure, unit-tested math: e1RM, volume, PR detection, streaks
  plates/               Plate-loading solver (lb/kg, exhaustively tested)
  db/                   IndexedDB via idb: versioned schema, repo, seed,
                        export/import
  units.ts              Canonical-kg storage, exact lb/kg conversion
  queries.ts            TanStack Query hooks over the repo
scripts/                Icon generation + audit/measurement harnesses
public/                 Manifest, service worker, generated icons
ITERATION_LOG.md        Full audit/fix/verify history and gate certification
```

## Architecture notes

- **Storage:** IndexedDB (via `idb`), versioned schema with a migration
  ladder. Weights stored canonically in kg; display conversion at the edge
  with exact `0.45359237` and step-rounding so `225 lb` round-trips exactly.
- **3D budget:** all geometry and textures are procedural (knurling normal
  map, particle sprites, HDRI-substitute Lightformer environment) — the 3D
  asset payload is 0 downloaded bytes, and three.js loads only when a scene
  mounts (`next/dynamic`, styled suspense fallbacks).
- **Reduced motion:** the OS preference and an in-app toggle both collapse
  UI animation and switch scenes to static loaded-bar renders with particles
  disabled.
- **Accessibility:** AA-verified monochrome palette (ratios documented in
  `app/globals.css`), full keyboard operability of the logger, visible white
  focus rings, ARIA labels on icon buttons, per-chart data tables.
- **Typography:** system font stack — SF Pro on Apple hardware, Inter
  elsewhere; data uses tabular figures.
- **Nexus hero:** 21st.dev Spline + Spotlight component (integrated via its
  copy-prompt export); streams from spline.design when online and falls back
  to the local procedural ambient scene offline.
