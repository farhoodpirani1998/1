# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: build — compile TypeScript, has full devDependencies available.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# package-lock.json is committed to this repo, so `npm ci` (reproducible,
# respects the lock file exactly) is the normal path here. The `npm
# install` branch below only exists as a defensive fallback for the
# unlikely case a checkout is missing it (e.g. a local .dockerignore
# mistake) so the build fails with a clear warning instead of npm ci's
# less obvious "package-lock.json not found" error.
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

# Sprint P1 — Universal Avatar System. docker-compose.yml mounts the
# named `avatar-uploads` volume at AVATAR_UPLOAD_DIR=/data/avatars. A
# brand-new named volume is initialized from whatever already exists at
# that path in the image; since nothing did, Docker would otherwise
# create it owned by root, and AvatarStorageService's fs.mkdir/writeFile
# (running as the unprivileged `node` user below) would fail with EACCES
# on every upload. Pre-creating it here with `node` ownership means the
# volume inherits the right permissions the first time it's mounted.
RUN mkdir -p /data/avatars && chown node:node /data/avatars

# The base image already ships an unprivileged `node` user (uid 1000) —
# use it instead of running the server as root.
USER node

EXPOSE 3000

# Matches the readiness/liveness endpoints added in src/modules/health.
# Uses wget (present in the alpine base via busybox) instead of curl to
# avoid adding an extra package just for this.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health/live || exit 1

# Database migrations are run explicitly (npm run migration:run:prod --
# this image has no ts-node/src, so the plain, dist/-based script is the
# one that works here; see src/database/data-source.ts), never on
# container boot — see app.module.ts's `migrationsRun: false`. Run them as
# a separate one-off step/job before rolling out a new image; see
# docs/DEPLOYMENT.md.
CMD ["node", "dist/main.js"]
