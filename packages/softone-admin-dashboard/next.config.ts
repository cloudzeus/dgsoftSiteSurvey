import type { NextConfig } from "next"
import path from "node:path"
import { fileURLToPath } from "node:url"
import createNextIntlPlugin from "next-intl/plugin"

// Monorepo root — avoids picking a parent folder's package-lock.json (Turbopack / tracing).
const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

const withNextIntl = createNextIntlPlugin("./i18n.ts")

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  turbopack: {
    root: monorepoRoot,
  },
  experimental: {
    // Enable server actions (stable in Next 16)
  },
  // Include translation JSON + Prisma engines in the standalone server output
  // so they exist at runtime in the deployed Docker image.
  outputFileTracingIncludes: {
    "/**/*": [
      "./messages/**/*",
      "./prisma/schema.prisma",
    ],
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

export default withNextIntl(nextConfig)
