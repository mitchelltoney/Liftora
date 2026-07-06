#!/usr/bin/env node
/**
 * Measures gzipped first-load JS per route by fetching each route's HTML
 * from the running server, collecting its <script src> chunks, and gzipping
 * the on-disk files. Gate: non-3D routes < 250 KB gzipped (3D code is lazy,
 * so it must not appear in any route's initial scripts).
 *
 * Usage: node scripts/bundle-size.mjs <baseURL>
 */
import { gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3311";
const ROUTES = ["/", "/log", "/history", "/analytics", "/settings"];

for (const route of ROUTES) {
  const html = await (await fetch(`${BASE}${route}`)).text();
  const srcs = [...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map(
    (m) => m[1],
  );
  const unique = [...new Set(srcs)];
  let total = 0;
  for (const src of unique) {
    const file = path.join(process.cwd(), ".next", src.replace("/_next/", ""));
    try {
      total += gzipSync(await readFile(file)).length;
    } catch {
      // Fall back to fetching if the on-disk path differs.
      const buf = Buffer.from(await (await fetch(`${BASE}${src}`)).arrayBuffer());
      total += gzipSync(buf).length;
    }
  }
  const three = unique.some((s) => /three|fiber|drei|postprocessing/i.test(s));
  console.log(
    `${route.padEnd(11)} ${String(unique.length).padStart(2)} scripts  ${(total / 1024).toFixed(1).padStart(7)} KB gz${three ? "  ⚠ contains 3D chunk names" : ""}`,
  );
}
