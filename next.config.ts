import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Server code reads data/cache/<content-hash>.json and data/sets/set-*/...
  // with a runtime-computed path (lib/cache/file-store.ts, lib/demo/load-set-data.ts),
  // so Next.js's output file tracing can't discover them statically and
  // drops them from the deployed serverless function by default, making
  // every committed cache entry a silent "not warmed yet" in production.
  outputFileTracingIncludes: {
    "/**": ["./data/cache/**/*", "./data/sets/**/*"],
  },
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
