FROM node:20-alpine AS build
WORKDIR /repo
COPY pnpm-workspace.yaml package.json ./
COPY packages/db ./packages/db
COPY apps/api ./apps/api
RUN corepack enable && pnpm install --frozen-lockfile=false
RUN pnpm --filter @train-sync/db generate
RUN pnpm --filter @train-sync/api build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/node_modules ./node_modules
COPY --from=build /repo/packages/db ./packages/db
EXPOSE 3001
CMD ["node", "dist/index.js"]
