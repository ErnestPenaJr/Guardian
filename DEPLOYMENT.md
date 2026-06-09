# Guardian MVP — Deployment

> Azure (App Service, SQL Server, DevOps pipeline, IIS) was fully retired on
> 2026-06-08. The legacy CommonJS monolith (`server.cjs` / `server.js` /
> `server-production.js`) and the `deployment/` build artifact were deleted.
> The app now runs as a **Vite/React frontend on Netlify** plus a **TypeScript
> Express server on PostgreSQL (Neon)**.

## Architecture

| Layer | What | Where |
|-------|------|-------|
| Frontend | React + Vite static build (`dist/`) | **Netlify** — site `guardian-mvp` (account `support@shieldlytics.com`, team Shieldlytics) |
| Backend | TypeScript Express API, `server/index.ts` → `dist-server/index.js` | **Host TBD** (runs off-Netlify; Netlify only serves the static frontend) |
| Database | PostgreSQL | **Netlify DB (Neon)** — database `netlifydb` |

## Frontend (Netlify)

Config lives in `netlify.toml`:
- Build command: `npm run build` (frontend only — **not** `build:all`)
- Publish dir: `dist`
- `NPM_FLAGS = --ignore-scripts` to skip the `postinstall` (prisma generate + backend build) that Netlify can't run
- SPA fallback redirect (`/* → /index.html`) for React Router

Deploys automatically from `github.com/ErnestPenaJr/Guardian` on push. The
static frontend talks to the backend API over HTTPS — set the API base URL via
the frontend's env/config to point at wherever the backend is hosted.

## Backend (TypeScript Express server)

```bash
npm run build:server          # tsc -> dist-server/
node dist-server/index.js      # start (honors DATABASE_URL, JWT_SECRET, PORT)
```

The backend is **not** hosted on Netlify (Netlify runs the static frontend +
functions, not a long-running Express process). Host it on an always-on
platform (Render / Railway / Fly / a VPS / on-prem) and set its environment:

- `DATABASE_URL` — the Neon connection string (see below)
- `JWT_SECRET` — random 32+ byte hex
- `PORT`, `NODE_ENV`, `FRONTEND_URL`, and email vars per `.env.example`

## Database (Neon)

The `GUARDIAN` schema lives in the Neon `netlifydb` database, provisioned via
Netlify DB and claimed into a Neon account for a stable connection string.

`DATABASE_URL` format (Prisma / PostgreSQL):

```
postgresql://USER:PASSWORD@HOST/netlifydb?sslmode=require&schema=GUARDIAN&connection_limit=30&pool_timeout=20
```

- Use the **direct** Neon endpoint for migrations/restores; use the pooled
  endpoint for the running app if connection counts get tight.
- Schema is owned by `postgres/01_schema.sql` + `02_seed.sql` +
  `03_app_schema_patches.sql`; Prisma is a **client only** (no migrate/db push).

## Local development

```bash
npm run dev:pg     # concurrently: TS API on Postgres + Vite frontend
# or individually:
npm run server:dev:pg   # backend against local Docker Postgres (localhost:5433)
npm run dev             # Vite frontend (proxies /api to the backend)
```
