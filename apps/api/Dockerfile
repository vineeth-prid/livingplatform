# ── Living API — multi-stage production image ────────────────────────────────
# Build context is the repo ROOT (see docker-compose api.build.context).

# 1. Base with pnpm via corepack.
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

# 2. Install workspace deps (cached on lockfile).
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile

# 3. Build: generate Prisma client + compile TS.
FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/api ./apps/api
RUN pnpm --filter @living/api db:generate \
  && pnpm --filter @living/api build

# 4. Production deps only.
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --prod

# 5. Runtime.
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/apps/api/package.json ./package.json
# Never run as root: a compromise of the API process must not own the container.
USER node
EXPOSE 4000
# Migrations run as a separate one-shot service (`migrate` in
# docker-compose.production.yml) before the API starts, not on every API boot.
CMD ["node", "dist/main.js"]
