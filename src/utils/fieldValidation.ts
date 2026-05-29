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

// Restrict raw typed text to digits + at most one dot + 2 decimal places.
export function maskCurrencyInput(raw: string): string {
  let s = (raw ?? '').replace(/[^0-9.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
    const [int, dec = ''] = s.split('.');
    s = int + '.' + dec.slice(0, 2);
  }
  return s;
}

// "$1,234.50" -> "1234.50" (value to store)
export function parseCurrency(display: string): string {
  if (!display) return '';
  const s = String(display).replace(/[^0-9.]/g, '');
  return s;
}

// "1234.5" -> "$1,234.50" (display only)
export function formatCurrency(raw: string): string {
  if (raw === '' || raw == null) return '';
  const stripped = parseCurrency(String(raw));
  if (stripped === '') return '';
  const n = Number(stripped);
  if (Number.isNaN(n)) return '';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
