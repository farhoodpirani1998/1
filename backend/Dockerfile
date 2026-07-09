# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: build — compile TypeScript, has full devDependencies available.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# `npm ci` requires package-lock.json to exist — it errors out otherwise.
# This repo does not currently commit one, so blindly running `npm ci` here
# would fail every build. Prefer `npm ci` (reproducible, respects the lock
# file) whenever a lock file is present, and fall back to `npm install`
# (resolves fresh, writes a new lock file into the image layer) when it
# isn't. Committing package-lock.json to the repo is still the recommended
# fix — see docs/DEPLOYMENT.md — this fallback only makes the build safe
# in the meantime.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci; \
    else \
      echo "WARNING: package-lock.json not found - falling back to npm install. Commit a lock file for reproducible builds." >&2; \
      npm install; \
    fi

COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: production dependencies only (no devDependencies in final image).
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app

# The builder stage always ends up with a package-lock.json (either the
# committed one, untouched by npm ci, or one freshly written by its npm
# install fallback). Reuse that exact file so both stages resolve
# identical versions, then npm ci is always safe to use here.
COPY package.json ./
COPY --from=builder /app/package-lock.json ./package-lock.json
RUN npm ci --omit=dev && npm cache clean --force

# ---------------------------------------------------------------------------
# Stage 3: runtime — minimal image, non-root user, only compiled output +
# production node_modules.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

# The base image already ships an unprivileged `node` user (uid 1000) —
# use it instead of running the server as root.
USER node

EXPOSE 3000

# Matches the readiness/liveness endpoints added in src/modules/health.
# Uses wget (present in the alpine base via busybox) instead of curl to
# avoid adding an extra package just for this.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health/live || exit 1

# Database migrations are run explicitly (npm run migration:run), never on
# container boot — see app.module.ts's `migrationsRun: false`. Run them as
# a separate one-off step/job before rolling out a new image; see
# docs/DEPLOYMENT.md.
CMD ["node", "dist/main.js"]
