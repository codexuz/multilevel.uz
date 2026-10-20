# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM node:22-alpine AS build
WORKDIR /app

# Install all deps (build needs the dev deps: nuxt, vite, etc.)
COPY package.json package-lock.json ./
RUN npm ci

# Build the Nuxt app → self-contained Nitro server in /app/.output.
# npm ci's postinstall ran `nuxt prepare` before the sources were here, leaving a .nuxt whose
# tsconfig knows no `~` paths, so the Vue compiler cannot resolve type imports such as
# `~/types/question-props`. Prepare again with the sources in place, then build.
COPY . .
ENV NODE_ENV=production
RUN npx nuxt prepare && npm run build

# ---------- Runtime stage ----------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3004

# Nitro bundles its own node_modules into .output, so that's all we need, plus the SQL
# migrations the server applies on start (server/plugins/migrate.ts).
COPY --from=build --chown=node:node /app/.output ./.output
COPY --from=build --chown=node:node /app/server/database/migrations ./server/database/migrations

USER node
EXPOSE 3004

# Simple container-level liveness check against the health endpoint.
# The start period covers applying migrations; requests wait for them.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3004/api/health || exit 1

CMD ["node", ".output/server/index.mjs"]
