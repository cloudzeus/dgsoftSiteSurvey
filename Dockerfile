# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/softone-admin-dashboard/package.json ./packages/softone-admin-dashboard/
COPY packages/softone-sync/package.json ./packages/softone-sync/

RUN npm ci --ignore-scripts

# ── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/softone-admin-dashboard/node_modules ./packages/softone-admin-dashboard/node_modules 2>/dev/null || true
COPY . .

# Guarantee public/ exists so the runner COPY never fails (Next.js projects
# don't require one, but Docker COPY errors if the source is absent).
RUN mkdir -p packages/softone-admin-dashboard/public

RUN cd packages/softone-admin-dashboard && npx prisma generate
RUN npm run build -w softone-admin-dashboard

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Standalone server output (page rendering + Node modules)
COPY --from=builder --chown=nextjs:nodejs /app/packages/softone-admin-dashboard/.next/standalone ./

# Static assets (CSS, JS chunks, fonts, images).
# Next.js standalone intentionally omits .next/static — it must be copied
# separately. The static-proxy serves these directly from the filesystem
# so we never rely on Next.js's broken standalone static-file routing.
COPY --from=builder --chown=nextjs:nodejs \
     /app/packages/softone-admin-dashboard/.next/static \
     ./packages/softone-admin-dashboard/.next/static

# public/ assets (favicon, robots.txt, etc.)
COPY --from=builder --chown=nextjs:nodejs \
     /app/packages/softone-admin-dashboard/public \
     ./packages/softone-admin-dashboard/public

# Static-file proxy: runs on PORT=3000, forwards non-static to Next.js on :3001
COPY --chown=nextjs:nodejs \
     packages/softone-admin-dashboard/static-proxy.cjs \
     /usr/local/lib/static-proxy.cjs

# Entrypoint: starts Next.js on :3001, then starts the proxy on :3000
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run from inside the package dir so __dirname resolves correctly for Next.js
WORKDIR /app/packages/softone-admin-dashboard
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
