# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Copy workspace manifests
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

# Generate Prisma client
RUN cd packages/softone-admin-dashboard && npx prisma generate

# Build the Next.js app
RUN npm run build -w softone-admin-dashboard

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Standalone output includes only what's needed
COPY --from=builder /app/packages/softone-admin-dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/packages/softone-admin-dashboard/.next/static ./packages/softone-admin-dashboard/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/packages/softone-admin-dashboard/public ./packages/softone-admin-dashboard/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "packages/softone-admin-dashboard/server.js"]
