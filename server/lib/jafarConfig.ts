// server/lib/jafarConfig.ts
import prisma from "../prisma-client.js";

let cache: { ts: number; values: Record<string, string> } | null = null;
const TTL_MS = 30_000;

export async function getJafarConfig(key: string): Promise<string | null> {
  if (!cache || Date.now() - cache.ts > TTL_MS) {
    const rows = await prisma.jAFAR_PLATFORM_CONFIG.findMany();
    cache = {
      ts: Date.now(),
      values: Object.fromEntries(rows.map((r) => [r.CONFIG_KEY, r.CONFIG_VALUE])),
    };
  }
  return cache.values[key] ?? null;
}

export async function setJafarConfig(key: string, value: string, updatedBy: number): Promise<void> {
  await prisma.jAFAR_PLATFORM_CONFIG.upsert({
    where: { CONFIG_KEY: key },
    update: { CONFIG_VALUE: value, UPDATED_BY: updatedBy, UPDATED_AT: new Date() },
    create: { CONFIG_KEY: key, CONFIG_VALUE: value, UPDATED_BY: updatedBy },
  });
  cache = null;
}

export async function getLockedFields(): Promise<string[]> {
  const raw = await getJafarConfig('LOCKED_FIELDS');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export async function getPermittedSubpoenaFileTypes(): Promise<string[]> {
  const raw = await getJafarConfig('PERMITTED_SUBPOENA_FILE_TYPES');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export async function getDisclaimerText(): Promise<string> {
  return (await getJafarConfig('COMPLIANCE_DISCLAIMER_TEXT')) ?? '';
}
