import { describe, expect, it } from 'vitest';
import { fileExtension, formatDate, humanReadableFileSize, strLimit } from '../../src/utils/format.ts';
import { loadFixture, outcomeOf, type Outcome } from './fixtures.ts';

/** Recorded calls of the filters of the AngularJS 1.x frontend: the arguments and what each call returned. */
const recorded = loadFixture<{
  strLimit: Array<{ args: unknown[] } & Outcome>;
  fileExtension: Array<{ args: unknown[] } & Outcome>;
  formatDate: Array<{ args: unknown[] } & Outcome>;
}>('utils/format.json');

/** A recorded row without its inputs: just the outcome. */
const outcomeRow = (row: Outcome): Outcome => ('throws' in row ? { throws: row.throws } : { result: row.result });

describe('strLimit', () => {
  it('matches the recorded results over a table of inputs', () => {
    for (const row of recorded.strLimit) {
      const [input, limit, suffix] = row.args as [string, number, string?];
      expect(outcomeOf(() => (strLimit as (...args: unknown[]) => string)(...row.args)), `${input}/${limit}/${suffix ?? 'default'}`).toStrictEqual(outcomeRow(row));
    }
  });

  it('appends three dots by default and keeps short input', () => {
    expect(strLimit('abcdef', 3)).toBe('abc...');
    expect(strLimit('abc', 3)).toBe('abc');
  });
});

describe('fileExtension', () => {
  it('matches the recorded results', () => {
    for (const row of recorded.fileExtension) {
      expect(outcomeOf(() => fileExtension(row.args[0] as string)), String(row.args[0])).toStrictEqual(outcomeRow(row));
    }
  });

  it('cuts long extensions to three characters plus two dots', () => {
    expect(fileExtension('a.jpeg')).toBe('jpe..');
    expect(fileExtension('a.png')).toBe('png');
    expect(fileExtension('noext')).toBe('');
  });
});

describe('humanReadableFileSize', () => {
  // Q-21, Q-38: changed on purpose from the recorded AngularJS output (divisor 1024 for decimal units, doubled
  // spaces, a 0.1 minimum, `1024.0 kB` for 1 MiB, `undefined` past the table), so these tables replace the recording.
  const decimal: Array<[number, string]> = [
    [0, '0.0 kB'],
    [1, '0.0 kB'],
    [100, '0.1 kB'],
    [999, '1.0 kB'],
    [1000, '1.0 kB'],
    [1536, '1.5 kB'],
    [999949, '999.9 kB'],
    [999960, '1.0 MB'],
    [1e6, '1.0 MB'],
    [1.5e6, '1.5 MB'],
    [1e9, '1.0 GB'],
    [1e12, '1.0 TB'],
    [1e15, '1.0 PB'],
    [1e18, '1.0 EB'],
    [1e21, '1.0 ZB'],
    [1e24, '1.0 YB'],
    [1.5e24, '1.5 YB'],
  ];
  const binary: Array<[number, string]> = [
    [0, '0.0 KiB'],
    [1, '0.0 KiB'],
    [100, '0.1 KiB'],
    [1023, '1.0 KiB'],
    [1024, '1.0 KiB'],
    [1536, '1.5 KiB'],
    [1024 ** 2 - 1, '1.0 MiB'],
    [1024 ** 2, '1.0 MiB'],
    [1.5 * 1024 ** 2, '1.5 MiB'],
    [1024 ** 3, '1.0 GiB'],
    [1024 ** 4, '1.0 TiB'],
    [1024 ** 5, '1.0 PiB'],
    [1024 ** 6, '1.0 EiB'],
    [1024 ** 7, '1.0 ZiB'],
    [1024 ** 8, '1.0 YiB'],
  ];

  it('uses divisor 1000 and the decimal units by default', () => {
    for (const [size, expected] of decimal) {
      expect(humanReadableFileSize(size, false), String(size)).toBe(expected);
    }
  });

  it('uses divisor 1024 and the binary units', () => {
    for (const [size, expected] of binary) {
      expect(humanReadableFileSize(size, true), String(size)).toBe(expected);
    }
  });

  it('puts exactly one space between number and unit', () => {
    for (const [size] of [...decimal, ...binary]) {
      expect(humanReadableFileSize(size, false)).toMatch(/^\d+\.\d [a-zA-Z]+$/);
      expect(humanReadableFileSize(size, true)).toMatch(/^\d+\.\d [a-zA-Z]+$/);
    }
  });

  it('stays in the last unit for values beyond the table', () => {
    expect(humanReadableFileSize(1e27, false)).toBe('1000.0 YB');
    expect(humanReadableFileSize(1e30, false)).toBe('1000000.0 YB');
    expect(humanReadableFileSize(1024 ** 9, true)).toBe('1024.0 YiB');
  });

  it('treats NaN, negative numbers and Infinity as 0', () => {
    for (const bad of [Number.NaN, -5, -Infinity, Infinity]) {
      expect(humanReadableFileSize(bad, false), String(bad)).toBe('0.0 kB');
      expect(humanReadableFileSize(bad, true), String(bad)).toBe('0.0 KiB');
    }
  });
});

describe('formatDate', () => {
  it('matches the recorded results for strings and numbers', () => {
    const valid = recorded.formatDate.filter((row) => 'result' in row);
    expect(valid).toHaveLength(3);
    for (const row of valid) {
      expect(outcomeOf(() => formatDate(row.args[0])), String(row.args[0])).toStrictEqual(outcomeRow(row));
    }
  });

  // Q-22: changed on purpose, the recording printed the UTC time. The dates are built from local fields, so the
  // expectations hold in any time zone.
  it('Q-22: prints the local wall-clock time of the date, independent of the time zone', () => {
    expect(formatDate(new Date(2020, 5, 7, 8, 9, 10))).toBe('2020-06-07 08:09:10');
    expect(formatDate(new Date(2020, 0, 2, 15, 2, 45))).toBe('2020-01-02 15:02:45');
    expect(formatDate(new Date(1999, 11, 31, 23, 59, 59))).toBe('1999-12-31 23:59:59');
    expect(formatDate(new Date(2020, 0, 1, 0, 0, 0))).toBe('2020-01-01 00:00:00');
  });

  it('does not throw for an Invalid Date, where the AngularJS filter threw a RangeError', () => {
    const [row] = recorded.formatDate.filter((entry) => 'throws' in entry);
    expect((row as { throws: { name: string } }).throws.name, 'recorded: the AngularJS filter threw').toBe('RangeError');
    expect(Number.isNaN((row.args[0] as Date).getTime())).toBe(true);
    expect(formatDate(row.args[0])).toBe('');
  });

  it('renders null and undefined as an empty string', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });
});
