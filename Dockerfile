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

# Fail the build immediately if the static bundle wasn't generated — prevents
# a silent broken image that serves 404 for all /_next/static/* assets.
RUN test -d packages/softone-admin-dashboard/.next/static || \
    { echo "ERROR: .next/static/ missing after build" >&2; exit 1; }

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Standalone server output (page rendering + Node modules)
COPY --from=builder --chown=nextjs:nodejs /app/packages/softone-admin-dashboard/.next/standalone ./

# Static assets — standalone output intentionally omits .next/static.
# Missing this causes Next.js to silently return 404 for all /_next/static/* URLs.
COPY --from=builder --chown=nextjs:nodejs \
     /app/packages/softone-admin-dashboard/.next/static \
     ./packages/softone-admin-dashboard/.next/static

# public/ assets (favicon, robots.txt, etc.) — directory is guaranteed by builder
COPY --from=builder --chown=nextjs:nodejs \
     /app/packages/softone-admin-dashboard/public \
     ./packages/softone-admin-dashboard/public

COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run from inside the package dir so __dirname and process.cwd() agree,
# which is where Next.js resolves .next/static and public at runtime.
WORKDIR /app/packages/softone-admin-dashboard
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
