import { describe, expect, it } from 'vitest';
import { assertHttpsCsvUrl, parseCsvLine, parseCsvText } from './csv.js';

describe('parseCsvLine', () => {
  it('splits simple commas', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields with commas', () => {
    expect(parseCsvLine('"a,b",c')).toEqual(['a,b', 'c']);
  });

  it('escapes doubled quotes', () => {
    expect(parseCsvLine('"a""b",x')).toEqual(['a"b', 'x']);
  });

  it('toggles quote state', () => {
    expect(parseCsvLine('"hello",world')).toEqual(['hello', 'world']);
  });
});

describe('parseCsvText', () => {
  it('returns empty for empty input', () => {
    expect(parseCsvText('')).toEqual({ headers: [], rows: [] });
  });

  it('parses header and rows', () => {
    const r = parseCsvText('Name,Score\nAlice,10\nBob,20');
    expect(r.headers).toEqual(['Name', 'Score']);
    expect(r.rows).toEqual([
      { Name: 'Alice', Score: '10' },
      { Name: 'Bob', Score: '20' },
    ]);
  });

  it('handles CRLF', () => {
    const r = parseCsvText('A\r\n1');
    expect(r.headers).toEqual(['A']);
    expect(r.rows).toEqual([{ A: '1' }]);
  });

  it('skips empty header cells when building headers array', () => {
    const r = parseCsvText('A,,B\n1,2,3');
    expect(r.headers).toEqual(['A', 'B']);
  });
});

describe('assertHttpsCsvUrl', () => {
  it('accepts valid https URL', () => {
    expect(assertHttpsCsvUrl('https://example.com/x.csv')).toBe('https://example.com/x.csv');
  });

  it('trims whitespace', () => {
    expect(assertHttpsCsvUrl('  https://example.com/x  ')).toBe('https://example.com/x');
  });

  it('rejects http', () => {
    expect(() => assertHttpsCsvUrl('http://example.com')).toThrow('Only https://');
  });

  it('rejects invalid URL', () => {
    expect(() => assertHttpsCsvUrl('not a url')).toThrow('Invalid URL');
  });

  it('rejects long URL', () => {
    const long = `https://example.com/${'x'.repeat(2100)}`;
    expect(() => assertHttpsCsvUrl(long)).toThrow('URL too long');
  });
});
