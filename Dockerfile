# syntax=docker/dockerfile:1.4
# ============================================================================
# Multi-Architecture Production Dockerfile (linux/amd64, linux/arm64)
# FAMILY Wealth Intelligence System — Phase 14 Production Baseline
# Database: MySQL 8.4 LTS
# ============================================================================

# ----------------------------------------------------------------------------
# Stage 1: Build & Quality Verification Stage
# ----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Enable Corepack for deterministic pnpm version management
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency manifests and local patches
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Install all dependencies with strict lockfile integrity
RUN pnpm install --frozen-lockfile

# Copy full application source code
COPY . .

# Run static type verification and production bundle compilation
RUN pnpm check
RUN pnpm build

# Retain full node_modules so all runtime and build-time plugins remain available
# RUN pnpm prune --prod

# ----------------------------------------------------------------------------
# Stage 2: Minimal Production Runtime
# ----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Install runtime dependencies for healthchecks, init processes, and TLS
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    dumb-init \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Enable Corepack for running drizzle-kit migrations at startup
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set production environment flags
ENV NODE_ENV=production
ENV PORT=3000

# Copy runtime artifacts from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Copy startup entrypoint script
COPY deploy/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Create local vault/storage directory with proper permissions
RUN mkdir -p /app/vault_storage && chown -R node:node /app

# Switch to non-privileged runtime user
USER node

# Expose web service port
EXPOSE 3000

# Healthcheck monitoring readiness probe (database connectivity & service health)
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:3000/readyz || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--", "./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
