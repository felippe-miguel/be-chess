FROM node:24-slim AS base
WORKDIR /app

# `corepack install` reads the "packageManager" field (with its sha512 hash)
# from the package.json in the current directory, so it must be present
# before this runs. That's what makes the pinned pnpm version (not
# whatever "latest" corepack would otherwise shim) the one actually used.
COPY package.json ./
RUN corepack enable pnpm && corepack install

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/chess-core/package.json packages/chess-core/package.json
RUN corepack pnpm install --frozen-lockfile --filter @chesslab/web...

FROM deps AS builder
COPY apps/web apps/web
COPY packages/chess-core packages/chess-core
RUN corepack pnpm --filter @chesslab/web build

# `vite.config.ts` only configures a dev-server proxy (`server.proxy`),
# which Vite applies exclusively to `vite dev`. It has no effect on the
# static assets produced by `vite build`, so the runtime image below must
# proxy `/api` itself (nginx, mirroring what the dev server does).
FROM nginx:alpine AS runtime
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY infrastructure/docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
