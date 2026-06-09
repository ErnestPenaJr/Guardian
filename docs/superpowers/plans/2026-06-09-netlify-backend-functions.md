# Guardian Backend on Netlify Functions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the existing Guardian TypeScript Express API on Netlify as a single serverless Function (via `serverless-http`), talking to the Neon Postgres DB, so the deployed `guardian-mvp` site works end-to-end.

**Architecture:** Split the Express app builder (`server/app.ts`, exports the configured `app`, no `listen`/static) from the local entry (`server/index.ts`, adds static + `listen`). A new `netlify/functions/api.ts` wraps `app` with `serverless-http`. `netlify.toml` rewrites `/api/*` and `/logout` to the Function; the CDN serves the static frontend. Prisma is built for the AWS Lambda runtime and points at the Neon pooled endpoint.

**Tech Stack:** Express 4, `serverless-http`, Netlify Functions (esbuild bundler), Prisma 6 + Neon Postgres, Vite frontend.

Spec: `docs/superpowers/specs/2026-06-09-netlify-backend-functions-design.md`

---

## File Structure

- Create: `server/app.ts` — the configured Express `app` (all middleware, routes, error + process handlers), `export default app`. No static serving, no SPA catch-all, no `listen`.
- Create: `server/index.ts` (replaces current) — local-dev entry: imports `app`, adds static serving + SPA fallback + `app.listen`.
- Create: `netlify/functions/api.ts` — `serverless-http` handler wrapping `app`.
- Modify: `schema.prisma` — add `rhel-openssl-3.0.x` binary target.
- Modify: `netlify.toml` — build command, `[functions]` config, `/api/*` + `/logout` redirects.
- Modify: `server/routes/external.ts` — multer `diskStorage` → `memoryStorage`.
- Modify: `package.json` — add `serverless-http` + `@netlify/functions`.

---

## Task 1: Add dependencies and Prisma Lambda target

**Files:**
- Modify: `package.json` (dependencies)
- Modify: `schema.prisma:1-5`

- [ ] **Step 1: Install runtime deps**

Run:
```bash
npm install serverless-http
npm install -D @netlify/functions
```
Expected: both added to `package.json`, `npm install` exits 0.

- [ ] **Step 2: Add the AWS Lambda binary target to Prisma**

In `schema.prisma`, change the generator block:
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-3.0.x", "rhel-openssl-3.0.x", "windows"]
  engineType    = "binary"
}
```

- [ ] **Step 3: Regenerate the client and confirm the Lambda engine exists**

Run:
```bash
npx prisma generate
ls node_modules/.prisma/client/ | grep -E "rhel-openssl-3.0.x"
```
Expected: a file like `libquery_engine-rhel-openssl-3.0.x.so.node` is listed.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json schema.prisma
git commit -m "build(netlify): add serverless-http + Prisma rhel (Lambda) binary target"
```

---

## Task 2: Split Express app from the local server entry

**Files:**
- Create: `server/app.ts` (from current `server/index.ts`)
- Create: `server/index.ts` (new thin local entry)

- [ ] **Step 1: Rename the current entry to `app.ts`**

Run:
```bash
git mv server/index.ts server/app.ts
```

- [ ] **Step 2: Remove the `PORT` constant from `server/app.ts`**

In `server/app.ts`, delete this line (currently ~line 76 — it is only used by the `listen` we are removing):
```ts
const PORT = process.env.PORT || 3001;
```

- [ ] **Step 3: Remove the static-serving block from `server/app.ts`**

Delete these lines (currently ~211–214):
```ts
// Serve static files from the frontend dist directory (after API routes)
const frontendDistPath = path.resolve(process.cwd(), 'dist');
console.log(`[STATIC FILES] Serving static files from: ${frontendDistPath}`);
app.use(express.static(frontendDistPath));
```

- [ ] **Step 4: Remove the SPA catch-all from `server/app.ts`**

Delete these lines (currently ~1447–1456):
```ts
// For all non-API routes, serve the index.html file (for SPA routing)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    // If it's an API route that wasn't handled, return 404
    return res.status(404).json({ error: 'Not Found' });
  }
  
  // Otherwise serve the SPA
  res.sendFile(join(frontendDistPath, 'index.html'));
});
```

- [ ] **Step 5: Replace the `app.listen(...)` block with an export**

In `server/app.ts`, delete this block (currently ~1479–1484):
```ts
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Access the application at: http://localhost:${PORT}`);
  console.log(`Global error capture system is active - errors will be emailed to ${ERROR_NOTIFY_EMAIL || EMAIL_FROM}`);
});
```
and add, as the **last line of the file**:
```ts
export default app;
```
(Keep the `process.on('unhandledRejection')` / `uncaughtException` handlers in `app.ts` as-is.)

- [ ] **Step 6: Create the new local entry `server/index.ts`**

```ts
import 'dotenv/config';
import * as path from 'path';
import express from 'express';
import app from './app.js';

// Local / standalone entry point. On Netlify the static frontend is served by
// the CDN and only /api/* reaches the Function (netlify/functions/api.ts);
// this file is used for `node dist-server/index.js` and local dev.
const PORT = process.env.PORT || 3001;
const frontendDistPath = path.resolve(process.cwd(), 'dist');

// Serve the built frontend, then SPA fallback for client-side routes.
app.use(express.static(frontendDistPath));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not Found' });
  }
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Access the application at: http://localhost:${PORT}`);
});
```

- [ ] **Step 7: Type-check the server**

Run:
```bash
npx tsc -p tsconfig.server.json --noEmit
```
Expected: exits 0, no errors. (If it reports an unused symbol or missing `join`, fix per Steps 2–6.)

- [ ] **Step 8: Build and smoke-test the local server against Neon**

Run:
```bash
npm run build:server
node dist-server/index.js &
SERVER_PID=$!
sleep 6
curl -s -m 15 http://localhost:3001/api/health
curl -s -m 20 -o /dev/null -w "login HTTP %{http_code}\n" -X POST http://localhost:3001/api/login -H 'Content-Type: application/json' -d '{"email":"ernest@shieldlytics.com","password":"__wrong__"}'
kill $SERVER_PID
```
Expected: health returns `{"status":"ok",...}`; login prints `login HTTP 401` (proves DB still wired). 

- [ ] **Step 9: Commit**

```bash
git add server/app.ts server/index.ts
git commit -m "refactor(server): split Express app (server/app.ts) from local entry (server/index.ts)"
```

---

## Task 3: Make file uploads serverless-safe (`external.ts`)

**Files:**
- Modify: `server/routes/external.ts:12-45` (multer config) and the upload handler (~340–360)

- [ ] **Step 1: Replace `diskStorage` with `memoryStorage`**

In `server/routes/external.ts`, replace the storage + multer config (the `const storage = multer.diskStorage({...})` block, ~lines 13–26) and the `const upload = multer({ storage, ... })` so it reads:
```ts
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 6 * 1024 * 1024, // ~6MB — Netlify Functions request-body cap
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowedFileTypes = [
      '.pdf', '.doc', '.docx', '.xls', '.xlsx',
      '.jpg', '.jpeg', '.png', '.gif', '.txt'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedFileTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Office documents, images, and text files are allowed.'));
    }
  }
});
```

- [ ] **Step 2: Use the in-memory buffer instead of reading/deleting a temp file**

Find the upload handler (~lines 340–360) where it does:
```ts
const fileData = fs.readFileSync(file.path);
```
…and later:
```ts
fs.unlinkSync(file.path);
```
Replace `const fileData = fs.readFileSync(file.path);` with:
```ts
const fileData = file.buffer;
```
and **delete** the `fs.unlinkSync(file.path);` line (no temp file exists with memoryStorage).

- [ ] **Step 3: Remove now-unused fs/dir code**

Remove any remaining references in `external.ts` to the `uploads` dir creation and unused `fs`/`path` imports **only if** they are no longer referenced. Confirm with:
```bash
grep -nE "fs\.|require\('fs'\)|from 'fs'|uploads" server/routes/external.ts
```
Keep `path` if still used by `path.extname`. Remove `import fs` only if `grep` shows no `fs.` usages remain.

- [ ] **Step 4: Type-check**

Run:
```bash
npx tsc -p tsconfig.server.json --noEmit
```
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add server/routes/external.ts
git commit -m "fix(uploads): use multer memoryStorage in external.ts for serverless (Netlify)"
```

---

## Task 4: Create the Netlify Function wrapper

**Files:**
- Create: `netlify/functions/api.ts`

- [ ] **Step 1: Write the Function**

```ts
// Single catch-all Function: wraps the whole Express API with serverless-http.
// netlify.toml rewrites /api/* and /logout to /.netlify/functions/api.
import serverless from 'serverless-http';
import app from '../../server/app.js';

export const handler = serverless(app);
```

- [ ] **Step 2: Type-check the function with the server tsconfig include**

Run:
```bash
npx tsc --noEmit netlify/functions/api.ts --module nodenext --moduleResolution nodenext --esModuleInterop --skipLibCheck
```
Expected: exits 0 (resolves `serverless-http` default import and `../../server/app.js`). If `serverless-http` lacks types, add `// @ts-expect-error` above the import or install `@types/serverless-http` (`npm i -D @types/serverless-http`).

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/api.ts
git commit -m "feat(netlify): add serverless-http Function wrapping the Express API"
```

---

## Task 5: Configure `netlify.toml` (build, functions, redirects)

**Files:**
- Modify: `netlify.toml`

- [ ] **Step 1: Update the build command to generate Prisma**

In `netlify.toml`, change the `[build]` `command` to:
```toml
[build]
  command = "npx prisma generate && npm run build"
  publish = "dist"
```
(Leave `NODE_VERSION` and `NPM_FLAGS = "--ignore-scripts"` in `[build.environment]` as-is — we now run `prisma generate` explicitly.)

- [ ] **Step 2: Add the functions config (bundler + Prisma engine)**

Add this block to `netlify.toml`:
```toml
[functions]
  node_bundler = "esbuild"
  # Ship the generated Prisma client + Lambda query engine + schema inside the
  # Function bundle, and keep @prisma/client external so esbuild doesn't mangle
  # its engine resolution.
  included_files = [
    "node_modules/.prisma/client/**",
    "schema.prisma"
  ]
  external_node_modules = ["@prisma/client"]
```

- [ ] **Step 3: Add API redirects BEFORE the SPA fallback**

In `netlify.toml`, add these two redirect blocks **above** the existing `from = "/*"` SPA redirect:
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
Confirm the existing SPA redirect (`from = "/*"` → `/index.html`, status 200) remains the **last** redirect block.

- [ ] **Step 4: Commit**

```bash
git add netlify.toml
git commit -m "build(netlify): wire /api/* to the Function, bundle Prisma engine, generate client in build"
```

---

## Task 6: Set Netlify environment variables

**Files:** none (Netlify site config via CLI). Site must be linked (it is: `guardian-mvp`).

- [ ] **Step 1: Get the Neon POOLED connection string**

The serverless Function must use the pooled endpoint (host contains `-pooler`), not the direct one. Obtain it from the Netlify project's Database page or the Neon console (Connection Details → "Pooled connection"). It looks like:
```
postgresql://netlifydb_owner:<password>@ep-steep-violet-ajss7e3s-pooler.c-3.us-east-2.db.netlify.com/netlifydb?sslmode=require
```
Final value to set (append Prisma params):
```
postgresql://netlifydb_owner:<password>@<pooler-host>/netlifydb?sslmode=require&schema=GUARDIAN&pgbouncer=true&connection_limit=1
```

- [ ] **Step 2: Set the env vars on the site**

Run (substitute real values; `JWT_SECRET` matches the one in `.env`):
```bash
netlify env:set DATABASE_URL "postgresql://netlifydb_owner:<password>@<pooler-host>/netlifydb?sslmode=require&schema=GUARDIAN&pgbouncer=true&connection_limit=1"
netlify env:set JWT_SECRET "3d96d990be404b3b88b4efa2bdf85b3b97003a1083fec5f2426edfe5cb56a7b0"
netlify env:set JWT_EXPIRES_IN "24h"
netlify env:set RESEND_API_KEY "<resend-api-key>"
netlify env:set EMAIL_FROM "support@shieldlytics.com"
netlify env:set FRONTEND_URL "https://guardian-mvp.netlify.app"
```

- [ ] **Step 3: Verify they are set (names only)**

Run:
```bash
netlify env:list --plain
```
Expected: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL` all listed (alongside `NODE_VERSION`, `NPM_FLAGS`).

(No commit — this is remote site config, not repo state.)

---

## Task 7: Build, deploy to a preview, verify end-to-end, then promote

**Files:** none (deploy + verification). Contingency edit to `server/app.ts` only if Step 3 fails.

- [ ] **Step 1: Build the Function bundle locally**

Run:
```bash
netlify build
```
Expected: build succeeds; output shows the `api` function bundled. If it fails on Prisma engine resolution, confirm Task 1 Step 3 produced the `rhel-openssl-3.0.x` engine and that the path in `netlify.toml` `included_files` matches the actual filename.

- [ ] **Step 2: Deploy a deploy-preview (not production)**

Run:
```bash
netlify deploy --build
```
Expected: prints a **Website Draft URL** (preview). Capture it as `PREVIEW_URL`.

- [ ] **Step 3: Verify the API on the preview**

Run (replace `PREVIEW_URL`):
```bash
curl -s -m 30 PREVIEW_URL/api/health
curl -s -m 30 -o /dev/null -w "login HTTP %{http_code}\n" -X POST PREVIEW_URL/api/login -H 'Content-Type: application/json' -d '{"email":"ernest@shieldlytics.com","password":"__wrong__"}'
```
Expected: health → `{"status":"ok",...}`; login → `login HTTP 401`.

**Contingency (only if `/api/health` returns 404):** the Function is receiving the rewritten path `/.netlify/functions/api/...` instead of `/api/...`. Add this as the FIRST middleware in `server/app.ts` (immediately after `const app = express()`):
```ts
// Netlify rewrites /api/* to /.netlify/functions/api/* — normalize back so
// the Express routes (mounted at /api/...) match.
app.use((req, _res, next) => {
  if (req.url.startsWith('/.netlify/functions/api')) {
    req.url = req.url.replace('/.netlify/functions/api', '') || '/';
  }
  next();
});
```
Then re-run Steps 1–3.

- [ ] **Step 4: Verify a real authenticated, Neon-backed read on the preview**

Mint a token for an active user and call a protected endpoint (uses the JWT_SECRET set on Netlify, which equals the one in `.env`):
```bash
JWT_SECRET=$(grep '^JWT_SECRET=' .env | cut -d= -f2- | tr -d '"')
TOKEN=$(JWT_SECRET="$JWT_SECRET" node -e "const jwt=require('jsonwebtoken'); console.log(jwt.sign({id:1253,email:'verify@local',COMPANY_ID:94,roles:[3]}, process.env.JWT_SECRET, {expiresIn:'10m'}))")
curl -s -m 30 -w "\nHTTP %{http_code}\n" PREVIEW_URL/api/notifications/count -H "Authorization: Bearer $TOKEN"
```
Expected: `{"success":true,"unreadCount":13}` HTTP 200 (proves the deployed Function reaches Neon and serves real data).

- [ ] **Step 5: Commit any contingency change**

If Step 3's contingency middleware was added:
```bash
git add server/app.ts
git commit -m "fix(netlify): normalize function path prefix so /api/* routes match"
```

- [ ] **Step 6: Promote to production**

Run:
```bash
netlify deploy --build --prod
```
Then verify production:
```bash
curl -s -m 30 https://guardian-mvp.netlify.app/api/health
```
Expected: `{"status":"ok",...}`. Open https://guardian-mvp.netlify.app, log in with real credentials, and confirm dashboard data + notifications load.

---

## Notes for the implementer

- **Same-origin:** the production frontend calls `window.location.origin` (`src/utils/api.ts:9`); the `/api/*` rewrite keeps it same-origin, so no CORS changes are needed.
- **Cold starts** (~1–3 s first request after idle), the **~6 MB upload cap**, and **per-instance rate limiting** are accepted limitations (see spec).
- **Do not** push to the `github` remote as part of this plan unless the user asks — Netlify auto-deploys from GitHub, but this plan deploys via the CLI (`netlify deploy`) so we control preview-then-prod.
