import { describe, expect, it } from 'vitest';
import { fileExtension, formatDate, humanReadableFileSize, strLimit } from '../../src/utils/format.ts';
import { loadFixture, outcomeOf, type Outcome } from './fixtures.ts';

/** Recorded calls of the filters of the AngularJS 1.x frontend: the arguments and what each call returned. */
const recorded = loadFixture<{
  strLimit: Array<{ args: unknown[] } & Outcome>;
  fileExtension: Array<{ args: unknown[] } & Outcome>;
  humanReadableFileSize: Array<{ binary: boolean; size: number } & Outcome>;
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
  it('matches the recorded results for decimal and binary prefixes', () => {
    for (const row of recorded.humanReadableFileSize) {
      expect(outcomeOf(() => humanReadableFileSize(row.size, row.binary)), `${row.size}/${row.binary}`).toStrictEqual(outcomeRow(row));
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
  it('matches the recorded results for valid dates, strings and numbers', () => {
    const valid = recorded.formatDate.filter((row) => 'result' in row);
    expect(valid).toHaveLength(6);
    for (const row of valid) {
      expect(outcomeOf(() => formatDate(row.args[0])), String(row.args[0])).toStrictEqual(outcomeRow(row));
    }
  });

  it('Q-22: prints the UTC time of the date', () => {
    expect(formatDate(new Date(Date.UTC(2020, 5, 7, 8, 9, 10)))).toBe('2020-06-07 08:09:10');
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
