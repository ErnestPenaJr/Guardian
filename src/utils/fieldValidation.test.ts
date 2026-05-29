import { describe, it, expect } from 'bun:test';
import { parseValidation } from './fieldValidation';
import { maskCurrencyInput, parseCurrency, formatCurrency } from './fieldValidation';
import { validateField, validateAll } from './fieldValidation';

describe('parseValidation', () => {
  it('parses a full JSON rule string', () => {
    expect(parseValidation('{"format":"currency","min":0,"max":1000000}'))
      .toEqual({ format: 'currency', min: 0, max: 1000000 });
  });
  it('returns empty rules for null/empty/garbage', () => {
    expect(parseValidation(null)).toEqual({ format: 'none' });
    expect(parseValidation('')).toEqual({ format: 'none' });
    expect(parseValidation('not json')).toEqual({ format: 'none' });
  });
  it('defaults missing format to none and drops non-numeric min/max', () => {
    expect(parseValidation('{"min":"x"}')).toEqual({ format: 'none' });
  });
});

describe('currency', () => {
  it('mask keeps digits and a single dot, max 2 decimals', () => {
    expect(maskCurrencyInput('$1,2a3.4567')).toBe('123.45');
    expect(maskCurrencyInput('12.3.4')).toBe('12.34');
    expect(maskCurrencyInput('abc')).toBe('');
  });
  it('parseCurrency strips formatting to a raw numeric string', () => {
    expect(parseCurrency('$1,234.50')).toBe('1234.50');
    expect(parseCurrency('')).toBe('');
  });
  it('formatCurrency renders $ + commas + 2 decimals', () => {
    expect(formatCurrency('1234.5')).toBe('$1,234.50');
    expect(formatCurrency('1000000')).toBe('$1,000,000.00');
    expect(formatCurrency('')).toBe('');
    expect(formatCurrency('abc')).toBe('');
  });
});

describe('validateField', () => {
  it('required blocks empty, allows present', () => {
    expect(validateField('', { format: 'none' }, true)).toBe('This field is required.');
    expect(validateField('hi', { format: 'none' }, true)).toBeNull();
  });
  it('skips format/length checks when empty and not required', () => {
    expect(validateField('', { format: 'email', min: 5 }, false)).toBeNull();
  });
  it('email/url/letters formats', () => {
    expect(validateField('bad', { format: 'email' }, false)).toBe('Enter a valid email address.');
    expect(validateField('a@b.co', { format: 'email' }, false)).toBeNull();
    expect(validateField('nope', { format: 'url' }, false)).toBe('Enter a valid web address (URL).');
    expect(validateField('https://x.com', { format: 'url' }, false)).toBeNull();
    expect(validateField('ab1', { format: 'letters' }, false)).toBe('Use letters only.');
    expect(validateField('Ab c', { format: 'letters' }, false)).toBeNull();
  });
  it('number/currency value range', () => {
    expect(validateField('5', { format: 'number', min: 10 }, false)).toBe('Must be at least 10.');
    expect(validateField('$5.00', { format: 'currency', max: 4 }, false)).toBe('Must be at most $4.00.');
    expect(validateField('$3.00', { format: 'currency', min: 0, max: 10 }, false)).toBeNull();
  });
  it('text length min/max', () => {
    expect(validateField('ab', { format: 'none', min: 3 }, false)).toBe('Must be at least 3 characters.');
    expect(validateField('abcd', { format: 'none', max: 3 }, false)).toBe('Must be at most 3 characters.');
  });
});

describe('validateAll', () => {
  it('returns fieldId -> error for each failing field', () => {
    const fields = [
      { key: '1', rules: { format: 'email' as const }, required: true },
      { key: '2', rules: { format: 'none' as const }, required: false },
    ];
    const values: Record<string, string> = { '1': 'bad', '2': '' };
    expect(validateAll(fields, values)).toEqual({ '1': 'Enter a valid email address.' });
  });
});
