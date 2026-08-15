import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root, otherwise Turbopack walks up past Dropbox and finds
  // a stray package-lock.json in the home directory.
  turbopack: { root: path.resolve(process.cwd()) },
  poweredByHeader: false,
};

export default nextConfig;
