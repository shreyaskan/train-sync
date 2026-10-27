# train-sync

Personal training plan app: syncs activities from Garmin Connect (unofficial API) and lets you build training plans/sessions.

## Stack

- `apps/api` — Fastify + TypeScript + Prisma/Postgres, Garmin sync job (hourly cron by default)
- `apps/web` — React + Vite
- `packages/db` — shared Prisma schema

## Local development

```bash
cp .env.example .env   # fill in GARMIN_EMAIL / GARMIN_PASSWORD
pnpm install

# start postgres only
docker compose up -d postgres

pnpm --filter @train-sync/db generate
pnpm --filter @train-sync/db migrate

pnpm dev:api   # http://localhost:3001
pnpm dev:web   # http://localhost:5173
```

## Deployment

```bash
docker compose up -d --build
```

Runs Postgres, the API (with the sync scheduler), and the web app (served via nginx on :8080).

## Notes

- Garmin sync uses the unofficial `garmin-connect` npm package, since there's no public personal-use Garmin API. It logs in with your normal Garmin Connect credentials — if Garmin changes their internal API this may break.
