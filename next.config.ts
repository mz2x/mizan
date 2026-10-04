import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // The dashboard store loads its database driver at request time; keep both out of the bundle
  // (PGlite reads its own wasm files from its package directory).
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  // The engine reads its corpus and enrichment index from disk at request time (fs.readFileSync on
  // a computed path), which file tracing cannot see; include them in the review route's trace.
  outputFileTracingIncludes: {
    "/api/review": ["./data/corpus/*.jsonl", "./data/enrichment.jsonl"],
  },
};

export default nextConfig;
