import { describe, expect, it } from 'vitest';
import { fileExtension, formatDate, humanReadableFileSize, strLimit } from '../../src/utils/format.ts';
import { legacyFilters } from './legacy.ts';

const cfg = { useBinarySizePrefixes: false };
const legacy = legacyFilters(cfg);

describe('strLimit', () => {
  const inputs = ['', 'a', 'abc', 'abcd', 'hello world', 'x'.repeat(40)];
  const limits = [0, 1, 3, 4, 11, 30, -2, 2.7, NaN, Infinity];

  it('matches the legacy filter over a table of inputs', () => {
    for (const input of inputs) {
      for (const limit of limits) {
        expect(strLimit(input, limit), `${input}/${limit}`).toBe(legacy.strLimit(input, limit));
        expect(strLimit(input, limit, '..'), `${input}/${limit}/..`).toBe(legacy.strLimit(input, limit, '..'));
        expect(strLimit(input, limit, ''), `${input}/${limit}/empty`).toBe(legacy.strLimit(input, limit, ''));
      }
    }
  });

  it('appends three dots by default and keeps short input', () => {
    expect(strLimit('abcdef', 3)).toBe('abc...');
    expect(strLimit('abc', 3)).toBe('abc');
  });
});

describe('fileExtension', () => {
  it('matches the legacy filter', () => {
    for (const input of ['', 'readme', 'a.txt', 'a.jpeg', 'archive.tar.gz', '.htaccess', 'trailing.', 'a.b.c.d.markdown']) {
      expect(fileExtension(input), input).toBe(legacy.fileExtension(input));
    }
  });

  it('cuts long extensions to three characters plus two dots', () => {
    expect(fileExtension('a.jpeg')).toBe('jpe..');
    expect(fileExtension('a.png')).toBe('png');
    expect(fileExtension('noext')).toBe('');
  });
});

describe('humanReadableFileSize', () => {
  const sizes = [0, 1, 100, 102, 103, 1023, 1024, 1025, 1536, 1048576, 1572864, 1073741824, 1024 ** 4, 1024 ** 5 * 3, 1024 ** 8, 1024 ** 9, 1e30, -5, NaN];

  it('matches the legacy filter for decimal and binary prefixes', () => {
    for (const binary of [false, true]) {
      cfg.useBinarySizePrefixes = binary;
      for (const size of sizes) {
        expect(humanReadableFileSize(size, binary), `${size}/${binary}`).toBe(legacy.humanReadableFileSize(size));
      }
    }
  });

  it('Q-21: an empty file shows 0.1 and the decimal unit has a doubled space', () => {
    expect(humanReadableFileSize(0, false)).toBe('0.1  kB');
    expect(humanReadableFileSize(1536, false)).toBe('1.5  kB');
    expect(humanReadableFileSize(1536, true)).toBe('1.5 KiB');
  });

  it('Q-21: the unit only advances above 1024, so 1024 of a unit stays in it', () => {
    expect(humanReadableFileSize(1024, false)).toBe('1.0  kB');
    expect(humanReadableFileSize(1024 * 1024, false)).toBe('1024.0  kB');
    expect(humanReadableFileSize(1024 * 1024 + 1, false)).toBe('1.0  MB');
    expect(humanReadableFileSize(1024 ** 3, true)).toBe('1024.0 MiB');
  });

  it('Q-21: units without a leading space and the end of the unit table', () => {
    expect(humanReadableFileSize(1.5 * 1024 ** 5, false)).toBe('1.5 PB');
    expect(humanReadableFileSize(1.5 * 1024 ** 8, true)).toBe('1.5 YiB');
    expect(humanReadableFileSize(1.5 * 1024 ** 9, true)).toBe('1.5 undefined');
  });
});

describe('formatDate', () => {
  it('matches the legacy filter for valid dates, strings and numbers', () => {
    const inputs: unknown[] = [new Date(2020, 0, 2, 3, 4, 5), new Date(0), new Date(Date.UTC(1999, 11, 31, 23, 59, 59)), 'text', 42, true];
    for (const input of inputs) {
      expect(formatDate(input), String(input)).toBe(legacy.formatDate(input));
    }
  });

  it('Q-22: prints the UTC time of the date', () => {
    expect(formatDate(new Date(Date.UTC(2020, 5, 7, 8, 9, 10)))).toBe('2020-06-07 08:09:10');
  });

  it('does not throw for an Invalid Date, where the legacy filter threw a RangeError', () => {
    expect(() => legacy.formatDate(new Date(NaN)), 'legacy throws').toThrow(RangeError);
    expect(formatDate(new Date(NaN))).toBe('');
  });

  it('renders null and undefined as an empty string', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });
});
