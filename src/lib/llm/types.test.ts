import { describe, it, expect } from 'vitest';
import { nullableTrimmedString } from './types';

describe('nullableTrimmedString', () => {
  it('passes null through', () => {
    expect(nullableTrimmedString.parse(null)).toBeNull();
  });

  it('converts empty string to null', () => {
    expect(nullableTrimmedString.parse('')).toBeNull();
  });

  it('converts whitespace-only string to null', () => {
    expect(nullableTrimmedString.parse('   ')).toBeNull();
    expect(nullableTrimmedString.parse('\n\t')).toBeNull();
  });

  it('trims surrounding whitespace and returns the inner text', () => {
    expect(nullableTrimmedString.parse('  hello  ')).toBe('hello');
  });

  it('keeps non-empty string intact', () => {
    expect(nullableTrimmedString.parse('0981595251')).toBe('0981595251');
  });

  it('rejects non-string non-null inputs', () => {
    expect(() => nullableTrimmedString.parse(123)).toThrow();
    expect(() => nullableTrimmedString.parse(undefined)).toThrow();
  });
});
