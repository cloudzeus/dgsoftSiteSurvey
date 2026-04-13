import type { NextConfig } from "next"
import path from "node:path"
import { fileURLToPath } from "node:url"

// Monorepo root — avoids picking a parent folder's package-lock.json (Turbopack / tracing).
const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: monorepoRoot,
  },
  experimental: {
    // Enable server actions (stable in Next 16)
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.b-cdn.net",
      },
    ],
  },
  // Transpile the workspace package
  transpilePackages: ["@softone/sync"],
}

export default nextConfig
