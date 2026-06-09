# Guardian Backend on Netlify Functions — Design

**Date:** 2026-06-09
**Status:** Approved (pending spec review)
**Approach:** A — single catch-all Netlify Function wrapping the existing Express app via `serverless-http`.

## Goal

Run the Guardian TypeScript Express backend on Netlify (same site as the
frontend, `guardian-mvp`), talking to the Neon Postgres database, so the
deployed site is fully usable end-to-end without a separate backend host.

## Context / current state

- Frontend: React/Vite static build deployed to Netlify (`guardian-mvp`,
  account `support@shieldlytics.com`). In production the frontend calls the API
  at `window.location.origin` (`src/utils/api.ts:9`), i.e. same-origin `/api/*`.
- Backend: a single TypeScript Express server, `server/index.ts` → compiled to
  `dist-server/index.js`, run with `node dist-server/index.js`. Currently runs
  only locally. It calls `app.listen()` (line ~1479) and also serves the static
  frontend + SPA catch-all (lines ~211–214, ~1448–1455).
- Database: Neon Postgres (Netlify DB), database `netlifydb`, `GUARDIAN` schema.
  Currently reached via the **direct** endpoint
  `ep-steep-violet-ajss7e3s.c-3.us-east-2.db.netlify.com`.
- Prisma: `binaryTargets = ["native","debian-openssl-3.0.x","windows"]`,
  `engineType = "binary"`. Each route file instantiates its own `new
  PrismaClient()`.
- Uploads: `requests.ts` uses multer `memoryStorage` and stores files as DB
  blobs (`ATTACHMENT: Buffer.from(file.buffer)`). `external.ts` uses multer
  `diskStorage`, then reads the file back (`fs.readFileSync(file.path)`) and
  deletes it — disk is only a temp staging step before the bytes are persisted.

## Constraints accepted (from brainstorming)

- **File uploads:** must keep working but only for **small files** (<~5 MB).
  Netlify Functions cap request bodies at ~6 MB and have no persistent disk
  (only ephemeral `/tmp`). Acceptable.
- **Cold starts:** acceptable. First request after idle is ~1–3 s
  (Lambda cold start + Prisma engine init + Neon connect).

## Design

### 1. App / entry split

- **New `server/app.ts`** — builds and exports the configured Express `app`:
  all middleware, route mounts, error handling. Contains **no** `app.listen()`
  and **no** static-file serving / SPA `*` catch-all (those are Netlify-CDN
  concerns and would interfere inside a Function).
- **`server/index.ts`** — becomes a thin local-dev entry: `import app from
  './app.js'`, add static serving + SPA fallback, `app.listen(PORT)`. Used by
  `npm run server:dev:pg` / `node dist-server/index.js` for local development.
- **New `netlify/functions/api.ts`** — `import app from '../../server/app.js'`,
  wrap with `serverless-http`, `export const handler`. Module-scope so the
  wrapped app is reused across warm invocations.

### 2. Routing (`netlify.toml`)

Add, **before** the existing SPA `/*` fallback:

```toml
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api/:splat"
  status = 200

[[redirects]]
  from = "/logout"
  to = "/.netlify/functions/api/logout"
  status = 200
```

The static frontend continues to be served by Netlify's CDN; the SPA `/*` →
`/index.html` fallback stays last. Same-origin, so **no CORS** changes needed.

### 3. Prisma for AWS Lambda

- Add `rhel-openssl-3.0.x` to `binaryTargets` in `schema.prisma` (Netlify
  Functions run on AWS Lambda / Amazon Linux; the existing `debian` target is
  for the build image, not the runtime).
- Run `prisma generate` during the Netlify build. The build currently uses
  `NPM_FLAGS = --ignore-scripts` (skips the postinstall `prisma generate`), so
  the build command changes to:
  `npx prisma generate && npm run build`.
- Bundle the query-engine binary into the Function via a `[functions]` block
  (esbuild bundler + `included_files` pointing at the generated
  `.prisma/client/*.so.node` engine), so the engine ships inside the Function
  zip.

### 4. Database connection (serverless-safe)

- Set the Function's `DATABASE_URL` to the Neon **pooled** endpoint (the
  `-pooler` host) with `?sslmode=require&schema=GUARDIAN&pgbouncer=true&connection_limit=1`.
  Pooling (PgBouncer) is required so many short-lived Function instances don't
  exhaust Neon's connection limit. The pooled connection string is retrieved
  from the Neon / Netlify database dashboard.
- The **direct** endpoint string stays in local `.env` files and is used for
  migrations / `pg_restore`.

### 5. File uploads

- `server/routes/external.ts`: replace multer `diskStorage` with
  `memoryStorage`; persist `file.buffer` directly (drop `fs.readFileSync` /
  `fs.unlinkSync` / the `uploads/` dir). Behavior matches `requests.ts`.
- Effective upload cap becomes ~6 MB (Netlify body limit), below the current
  10 MB multer limit; document this.

### 6. Netlify environment variables

Set on the `guardian-mvp` site (CLI or dashboard):

| Var | Value |
|-----|-------|
| `DATABASE_URL` | Neon **pooled** string (see §4) |
| `JWT_SECRET` | existing secret |
| `RESEND_API_KEY` (or `SMTP_PASSWORD`) | Resend key |
| `EMAIL_FROM` | `support@shieldlytics.com` |
| `FRONTEND_URL` | `https://guardian-mvp.netlify.app` |
| `JWT_EXPIRES_IN` | `24h` |

### 7. Dependencies

- Add `serverless-http`.
- `@netlify/functions` types as needed for the handler signature.

## Out of scope / known limitations (documented, not fixed now)

- **Cold starts** (~1–3 s first request after idle).
- **~6 MB upload cap** on the function path.
- **In-memory rate limiting** (`express-rate-limit`) resets per Function
  instance / cold start, so limits are best-effort, not global.
- **Per-route `new PrismaClient()`** — works, but a shared singleton would be
  cleaner on serverless; tracked as a follow-up, not in this scope.

## Verification

1. Local: `npx prisma generate` (with new target) succeeds; the Function bundle
   builds (`netlify build` / `netlify functions:build` locally).
2. Deploy to a Netlify **deploy preview** (not production) first.
3. Against the preview URL: `GET /api/health` → ok; real login returns a JWT;
   `GET /api/notifications` and another Neon-backed endpoint return real data;
   a small file upload succeeds.
4. Promote to production once the preview passes.
