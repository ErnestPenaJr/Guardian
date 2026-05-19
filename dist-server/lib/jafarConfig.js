// server/lib/jafarConfig.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
let cache = null;
const TTL_MS = 30000;
export async function getJafarConfig(key) {
    if (!cache || Date.now() - cache.ts > TTL_MS) {
        const rows = await prisma.jAFAR_PLATFORM_CONFIG.findMany();
        cache = {
            ts: Date.now(),
            values: Object.fromEntries(rows.map((r) => [r.CONFIG_KEY, r.CONFIG_VALUE])),
        };
    }
    return cache.values[key] ?? null;
}
export async function setJafarConfig(key, value, updatedBy) {
    await prisma.jAFAR_PLATFORM_CONFIG.upsert({
        where: { CONFIG_KEY: key },
        update: { CONFIG_VALUE: value, UPDATED_BY: updatedBy, UPDATED_AT: new Date() },
        create: { CONFIG_KEY: key, CONFIG_VALUE: value, UPDATED_BY: updatedBy },
    });
    cache = null;
}
export async function getLockedFields() {
    const raw = await getJafarConfig('LOCKED_FIELDS');
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
    }
    catch {
        return [];
    }
}
export async function getPermittedSubpoenaFileTypes() {
    const raw = await getJafarConfig('PERMITTED_SUBPOENA_FILE_TYPES');
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
    }
    catch {
        return [];
    }
}
export async function getDisclaimerText() {
    return (await getJafarConfig('COMPLIANCE_DISCLAIMER_TEXT')) ?? '';
}
