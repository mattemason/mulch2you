import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root, otherwise Turbopack walks up past Dropbox and finds
  // a stray package-lock.json in the home directory.
  turbopack: { root: path.resolve(process.cwd()) },
  poweredByHeader: false,
  experimental: {
    // Photos are downscaled in the browser to a few hundred KB, but the
    // default 1 MB action limit would still reject a large one from a phone
    // that couldn't run the canvas resize.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
