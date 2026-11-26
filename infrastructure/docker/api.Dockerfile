# NOTE: this image runs the API's TypeScript source directly through `tsx`
# at container start, rather than shipping a compiled JS bundle. That
# mirrors the workspace's current "no build step for workspace packages"
# design (see root README / review.md) and is an accepted trade-off for
# this milestone, not an oversight. A real production image should
# transpile/bundle ahead of time instead of paying the `tsx` startup cost
# and carrying the TypeScript toolchain into the runtime image.

FROM node:24-slim AS base
WORKDIR /app

# `corepack install` reads the "packageManager" field (with its sha512 hash)
# from the package.json in the current directory to decide which exact
# pnpm build to fetch and activate, so the root manifest has to be present
# before this runs. This is what makes the pinned pnpm version (not
# whatever "latest" corepack would otherwise shim) the one actually used.
COPY package.json ./
RUN corepack enable pnpm && corepack install

FROM base AS deps
# Copy only the manifests needed to resolve the workspace graph first, so
# this layer is cached independently of application source changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/chess-core/package.json packages/chess-core/package.json
RUN corepack pnpm install --frozen-lockfile --filter @chesslab/api...

FROM deps AS runtime
COPY apps/api apps/api
COPY packages/chess-core packages/chess-core

ENV NODE_ENV=production
EXPOSE 3000

USER node

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/v1/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["corepack", "pnpm", "--filter", "@chesslab/api", "start"]
