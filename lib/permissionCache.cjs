/**
 * In-memory cache for permission, form-allowlist, and notice-type-allowlist
 * overrides. Read on every request via the synchronous accessors; loaded
 * from the database on a TTL or on explicit invalidation after writes.
 *
 * Design:
 *   - A row in any of the three tables represents an EXPLICIT OVERRIDE.
 *     Absence means use the matrix default in lib/permissions.cjs.
 *   - Cache structure stores per-role lookups so resolution is O(roles)
 *     per check.
 *   - Resolution precedence (left wins):
 *       per-company override > global override (NULL company) > matrix default
 *     Phase 2 only writes global rows; per-company hooks remain dormant.
 *   - On a DB error during refresh the previous snapshot is kept so we
 *     never silently lose policy. A long-lived process simply keeps the
 *     last-known-good cache and retries on the next interval.
 */

const TTL_MS = 30_000;

let cache = {
  permissions: {},        // { [roleId]: { [permissionKey]: { global: bool|null, byCompany: { [companyId]: bool } } } }
  formAllowlist: {},      // same shape, key = formId (string)
  noticeTypeAllowlist: {},// same shape, key = noticeType
  loadedAt: 0,
};

let prismaRef = null;
let inflightLoad = null;

function setPrisma(prisma) {
  prismaRef = prisma;
}

function emptyEntry() {
  return { global: null, byCompany: {} };
}

function indexRows(rows, keyField) {
  const out = {};
  for (const row of rows) {
    const roleId = row.ROLE_ID;
    const key = String(row[keyField]);
    const granted = row.GRANTED === 1 || row.GRANTED === true;
    const companyId = row.COMPANY_ID;

    if (!out[roleId]) out[roleId] = {};
    if (!out[roleId][key]) out[roleId][key] = emptyEntry();

    if (companyId == null) {
      out[roleId][key].global = granted;
    } else {
      out[roleId][key].byCompany[companyId] = granted;
    }
  }
  return out;
}

async function loadFromDb() {
  if (!prismaRef) return; // not wired yet — leave defaults
  try {
    const [perms, forms, notices] = await Promise.all([
      prismaRef.$queryRawUnsafe(`SELECT ROLE_ID, PERMISSION_KEY, GRANTED, COMPANY_ID FROM GUARDIAN.ROLE_PERMISSIONS`),
      prismaRef.$queryRawUnsafe(`SELECT ROLE_ID, FORM_ID, GRANTED, COMPANY_ID FROM GUARDIAN.ROLE_FORM_ALLOWLIST`),
      prismaRef.$queryRawUnsafe(`SELECT ROLE_ID, NOTICE_TYPE, GRANTED, COMPANY_ID FROM GUARDIAN.ROLE_NOTICE_TYPE_ALLOWLIST`),
    ]);
    cache = {
      permissions:         indexRows(perms,   'PERMISSION_KEY'),
      formAllowlist:       indexRows(forms,   'FORM_ID'),
      noticeTypeAllowlist: indexRows(notices, 'NOTICE_TYPE'),
      loadedAt: Date.now(),
    };
  } catch (err) {
    // Common case on first boot before migration applies: tables missing.
    // Keep last-known-good cache (empty on first failure) and log.
    console.warn('[permissionCache] load failed, keeping previous snapshot:', err.message);
  }
}

/**
 * Block until first load completes. Call this once during server startup;
 * safe to invoke before prisma.$connect() resolves — Prisma lazy-connects on
 * the first query, and loadFromDb tolerates failures.
 *
 * Why interval-before-first-load: if the initial loadFromDb hangs (e.g., DB
 * sleeping), we still want the 30s refresh ticker armed so the cache can heal
 * itself once the DB wakes. Previously, awaiting loadFromDb before setInterval
 * meant a cold-DB boot left the cache stranded with no retry timer.
 */
let refreshTimer = null;
async function init(prisma) {
  setPrisma(prisma);
  if (!refreshTimer) {
    refreshTimer = setInterval(() => loadFromDb(), TTL_MS);
    if (typeof refreshTimer.unref === 'function') refreshTimer.unref();
  }
  await loadFromDb();
}

/**
 * Force a refresh now. Returns the promise so callers can await if needed.
 * Safe to call concurrently — concurrent calls share one in-flight load.
 */
function invalidate() {
  if (inflightLoad) return inflightLoad;
  inflightLoad = loadFromDb().finally(() => { inflightLoad = null; });
  return inflightLoad;
}

/**
 * Look up an override for (roleId, key) in the named bucket.
 * Returns true | false | null. null means "no override, use default".
 *
 * @param {'permissions'|'formAllowlist'|'noticeTypeAllowlist'} bucket
 */
function lookupOverride(bucket, roleId, key, companyId) {
  const entry = cache[bucket]?.[roleId]?.[String(key)];
  if (!entry) return null;
  if (companyId != null && Object.prototype.hasOwnProperty.call(entry.byCompany, companyId)) {
    return entry.byCompany[companyId];
  }
  return entry.global;
}

/** Snapshot accessor — returns the full cache for admin GET endpoints. */
function snapshot() {
  return cache;
}

module.exports = {
  init,
  invalidate,
  lookupOverride,
  snapshot,
  setPrisma, // exported for tests
};
