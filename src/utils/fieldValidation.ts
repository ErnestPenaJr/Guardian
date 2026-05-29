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
  if (s.startsWith('.')) s = '0' + s;
  return s;
}

// "$1,234.50" -> "1234.50" (value to store)
export function parseCurrency(display: string): string {
  if (!display) return '';
  let s = String(display).replace(/[^0-9.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  }
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i;
const LETTERS_RE = /^[A-Za-z\s]+$/;

export function validateField(value: string, rules: FieldRules, required: boolean): string | null {
  const v = (value ?? '').trim();
  if (!v) return required ? 'This field is required.' : null;

  switch (rules.format) {
    case 'email':
      if (!EMAIL_RE.test(v)) return 'Enter a valid email address.';
      break;
    case 'url':
      if (!URL_RE.test(v)) return 'Enter a valid web address (URL).';
      break;
    case 'letters':
      if (!LETTERS_RE.test(v)) return 'Use letters only.';
      break;
    case 'number':
    case 'currency': {
      if (rules.format === 'number' && !/^-?\d*\.?\d+$/.test(v)) return 'Enter a valid number.';
      const n = Number(rules.format === 'currency' ? parseCurrency(v) : v);
      if (Number.isNaN(n)) return rules.format === 'currency' ? 'Enter a valid amount.' : 'Enter a valid number.';
      if (typeof rules.min === 'number' && n < rules.min)
        return `Must be at least ${rules.format === 'currency' ? formatCurrency(String(rules.min)) : rules.min}.`;
      if (typeof rules.max === 'number' && n > rules.max)
        return `Must be at most ${rules.format === 'currency' ? formatCurrency(String(rules.max)) : rules.max}.`;
      return null;
    }
  }

  // length checks for text-like formats
  if (typeof rules.min === 'number' && v.length < rules.min) return `Must be at least ${rules.min} characters.`;
  if (typeof rules.max === 'number' && v.length > rules.max) return `Must be at most ${rules.max} characters.`;
  return null;
}

export function validateAll(
  fields: Array<{ key: string; rules: FieldRules; required: boolean }>,
  values: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const err = validateField(values[f.key] ?? '', f.rules, f.required);
    if (err) errors[f.key] = err;
  }
  return errors;
}
