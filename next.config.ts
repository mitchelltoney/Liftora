import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Verification/CI builds can set NEXT_DIST_DIR (e.g. ".next-verify") so
  // `next build` never clobbers a running dev server's .next artifacts.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Static export for GitHub Pages: NEXT_OUTPUT=export produces ./out.
  output: process.env.NEXT_OUTPUT === "export" ? "export" : undefined,
  // Project-site hosting serves from /<repo>; set by the deploy workflow.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  images: { unoptimized: true },
};

export default nextConfig;
