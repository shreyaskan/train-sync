FROM node:20-alpine AS build
WORKDIR /repo
COPY pnpm-workspace.yaml package.json ./
COPY apps/web ./apps/web
RUN corepack enable && pnpm install --frozen-lockfile=false
RUN pnpm --filter @train-sync/web build

FROM nginx:alpine
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
