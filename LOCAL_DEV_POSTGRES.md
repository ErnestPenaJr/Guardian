# Local Development on PostgreSQL

Run the full Guardian MVP stack (API + React frontend) against a local Docker
PostgreSQL instance with a single command — no Azure connection required.

---

## One-time setup

### 1. Start the Docker PostgreSQL container

```bash
docker run -d \
  --name guardian-pg \
  -e POSTGRES_PASSWORD=postgres \
  -p 5433:5432 \
  postgres:16
```

> Port **5433** is used to avoid clashing with any local PostgreSQL running on
> the default 5432.

### 2. Load the database

```bash
psql -h localhost -p 5433 -U postgres \
  -v ON_ERROR_STOP=1 \
  -f postgres/01_schema.sql

psql -h localhost -p 5433 -U postgres \
  -v ON_ERROR_STOP=1 \
  -f postgres/02_seed.sql

psql -h localhost -p 5433 -U postgres \
  -v ON_ERROR_STOP=1 \
  -f postgres/03_app_schema_patches.sql
```

**Note:** `postgres/02_seed.sql` is git-ignored — it contains a live data
snapshot and is regenerated on demand via the migration script:

```bash
node scripts/mssql-to-postgres.cjs --out ./postgres
```

This script exports a fresh snapshot from the Azure SQL Server (GUARDIAN-DEV)
and writes `02_seed.sql` (and any other per-table files) into `./postgres/`.

---

## Running the app

### Full stack (API + frontend) — the normal workflow

```bash
npm run dev:pg
```

- **API** → `http://localhost:3001`
- **Frontend** → `http://localhost:5175` (Vite dev server; `/api` and
  `/logout` requests are proxied to :3001)

Log in with any user that exists in your seeded data (e.g. Ernest's credentials
from the staging seed).

### API server only (no frontend)

```bash
npm run server:dev:pg
```

Useful when you only need the backend — Postman, curl, or running the React
frontend separately.

---

## Refreshing from staging

If the staging database has changed and you want a fresh local snapshot:

1. Regenerate the seed file:

   ```bash
   node scripts/mssql-to-postgres.cjs --out ./postgres
   ```

2. Drop and recreate the schema, then reload:

   ```bash
   psql -h localhost -p 5433 -U postgres \
     -c "DROP SCHEMA IF EXISTS \"GUARDIAN\" CASCADE; CREATE SCHEMA \"GUARDIAN\";"

   psql -h localhost -p 5433 -U postgres \
     -v ON_ERROR_STOP=1 \
     -f postgres/01_schema.sql

   psql -h localhost -p 5433 -U postgres \
     -v ON_ERROR_STOP=1 \
     -f postgres/02_seed.sql

   psql -h localhost -p 5433 -U postgres \
     -v ON_ERROR_STOP=1 \
     -f postgres/03_app_schema_patches.sql
   ```

---

## Notes

### Environment variables

`.env.local` documents the Postgres connection details for use with psql and
other tooling. The `dev:pg` and `server:dev:pg` scripts **set the environment
variables inline**, which is what actually overrides the SQL Server
`DATABASE_URL` defined in `.env`. `.env.local` is git-ignored and never
deployed.

### Prisma is client-only in this project

The Prisma client is used **only for query execution** — it is pre-generated
against the existing schema. **Never run `prisma migrate` or `prisma db push`
against the local Postgres instance.** Schema changes are managed via the SQL
migration files in `postgres/` and `migrations/`.

### Legacy SQL Server flow is unchanged

`npm run server:dev` still starts `server.cjs` against the Azure SQL Server
dev database exactly as before. The Postgres flow is additive — nothing in the
legacy path was modified.

### Port summary

| Service | Port |
|---------|------|
| Docker PostgreSQL | 5433 |
| API (TS server) | 3001 |
| Vite frontend | 5175 |
