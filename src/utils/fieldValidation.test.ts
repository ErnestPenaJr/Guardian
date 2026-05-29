import { describe, it, expect } from 'bun:test';
import { parseValidation } from './fieldValidation';
import { maskCurrencyInput, parseCurrency, formatCurrency } from './fieldValidation';

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
