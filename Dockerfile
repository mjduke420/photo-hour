# syntax=docker/dockerfile:1

# ---- Build every workspace ----------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Manifests first, so a dependency install is only redone when they change.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/web/package.json packages/web/package.json
RUN npm ci

COPY tsconfig.base.json tsconfig.json ./
COPY packages ./packages
RUN npm run build

# ---- Runtime dependencies only ------------------------------------------
FROM node:22-alpine AS production-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/web/package.json packages/web/package.json

# The browser bundle is already built, so none of the web dependencies are
# needed at runtime; only the server and the shared library are installed.
RUN npm ci --omit=dev \
      --include-workspace-root \
      --workspace @photo-hour/server \
      --workspace @photo-hour/shared \
    && npm cache clean --force

# ---- Final image ---------------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    DEM_CACHE_DIR=/data/dem-cache
WORKDIR /app

RUN mkdir -p /data/dem-cache && chown -R node:node /data

COPY --from=production-deps /app/node_modules ./node_modules
COPY package.json ./
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/server/package.json ./packages/server/package.json
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/web/dist ./packages/web/dist

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>{process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"

CMD ["node", "packages/server/dist/index.js"]
