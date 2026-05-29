import { describe, it, expect } from 'bun:test';
import { parseValidation } from './fieldValidation';

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
