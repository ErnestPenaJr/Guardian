export type FieldFormat = 'none' | 'email' | 'url' | 'number' | 'currency' | 'letters';

export interface FieldRules {
  format: FieldFormat;
  min?: number;
  max?: number;
}

const FORMATS: FieldFormat[] = ['none', 'email', 'url', 'number', 'currency', 'letters'];

export function parseValidation(raw?: string | null): FieldRules {
  if (!raw) return { format: 'none' };
  let obj: any;
  try { obj = JSON.parse(raw); } catch { return { format: 'none' }; }
  if (!obj || typeof obj !== 'object') return { format: 'none' };
  const format: FieldFormat = FORMATS.includes(obj.format) ? obj.format : 'none';
  const rules: FieldRules = { format };
  if (typeof obj.min === 'number' && !Number.isNaN(obj.min)) rules.min = obj.min;
  if (typeof obj.max === 'number' && !Number.isNaN(obj.max)) rules.max = obj.max;
  return rules;
}

export function serializeValidation(rules: Partial<FieldRules>): string | null {
  const format = rules.format && rules.format !== 'none' ? rules.format : undefined;
  const hasMin = typeof rules.min === 'number' && !Number.isNaN(rules.min);
  const hasMax = typeof rules.max === 'number' && !Number.isNaN(rules.max);
  if (!format && !hasMin && !hasMax) return null;
  const out: any = {};
  if (format) out.format = format;
  if (hasMin) out.min = rules.min;
  if (hasMax) out.max = rules.max;
  return JSON.stringify(out);
}
