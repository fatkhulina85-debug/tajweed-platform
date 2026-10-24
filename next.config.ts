import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tests/e2e/run.mjs builds into a separate folder so it does not
  // overwrite the regular build made with .env.local.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
