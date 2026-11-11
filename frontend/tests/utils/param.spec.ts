import { describe, expect, it } from 'vitest';
import { param } from '../../src/utils/param.ts';
import { loadFixture } from './fixtures.ts';

/** Recorded `$.param` calls of jQuery 3, which the AngularJS 1.x frontend used: the data and the query string. */
const recorded = loadFixture<{
  table: Array<{ name: string; data: unknown; result: string }>;
  extra: Array<{ name: string; data: unknown; result: string }>;
}>('utils/param.json');

describe('param', () => {
  it.each(recorded.table.map((row) => [row.name, row] as const))('matches the recorded jQuery 3 result for %s', (_name, row) => {
    expect(param(row.data as Record<string, unknown>)).toBe(row.result);
  });

  it('encodes array keys as items%5B%5D', () => {
    expect(param({ items: ['a', 'b'] })).toBe('items%5B%5D=a&items%5B%5D=b');
  });

  it('keeps spaces as %20 like jQuery 3 does (not +)', () => {
    expect(param({ a: 'b c' })).toBe('a=b%20c');
  });

  it('matches the recorded jQuery result for the name/value array form and for null input', () => {
    expect(recorded.extra.map((row) => row.name)).toEqual(['name/value pairs', 'null', 'undefined']);
    for (const row of recorded.extra) {
      expect(param(row.data as never), row.name).toBe(row.result);
    }
  });
});
