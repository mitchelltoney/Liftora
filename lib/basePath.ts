/**
 * Deployment base path (e.g. "/Liftora" on GitHub Pages project sites).
 * Next.js applies it to routes/assets automatically; this constant covers
 * the places it doesn't reach: manual location.assign, SW registration,
 * and metadata URLs.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
