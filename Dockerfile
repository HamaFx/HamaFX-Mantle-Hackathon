# HamaFX-AI — Unified production image
#
# Builds the Next.js app in standalone mode so the resulting image
# contains the web server AND the persistent daemon processes
# (SignalR consumer, Finnhub fallback, on-chain scanner) in a single
# Node.js runtime.
#
# Usage:
#   docker build -t hamafx-web .
#   docker run -p 3000:3000 --env-file .env.docker hamafx-web

# ── Stage 1: Install dependencies ──────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

RUN corepack enable && pnpm install --frozen-lockfile

# ── Stage 2: Build ────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app /app
COPY . .

# Build only the web app (which transitively includes worker-core)
RUN corepack enable && pnpm --filter @hamafx/web build

# ── Stage 3: Production runtime ───────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Next.js standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Expose the Next.js default port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

USER nextjs

CMD ["node", "apps/web/server.js"]
