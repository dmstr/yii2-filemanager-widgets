import { describe, expect, it } from 'vitest';
import { decode, localizeDates, localTime, outcomeOf } from './fixtures.ts';

describe('fixture decoder', () => {
  it('rebuilds the values JSON cannot represent', () => {
    const decoded = decode({
      a: { $$: 'undefined' },
      b: { $$: 'number', value: 'NaN' },
      c: { $$: 'number', value: 'Infinity' },
      d: { $$: 'number', value: '-Infinity' },
      e: { $$: 'number', value: '-0' },
      f: { $$: 'Date', iso: '2021-03-04T05:06:07.000Z' },
      g: { $$: 'Date', iso: null },
      h: { $$: 'RegExp', source: '\\.x$', flags: 'gi' },
      i: { $$: 'function', returns: 'called' },
    });
    expect(Object.keys(decoded)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
    expect(decoded.a).toBeUndefined();
    expect(decoded.b).toBeNaN();
    expect(decoded.c).toBe(Infinity);
    expect(decoded.d).toBe(-Infinity);
    expect(Object.is(decoded.e, -0)).toBe(true);
    expect(decoded.f.toISOString()).toBe('2021-03-04T05:06:07.000Z');
    expect(Number.isNaN(decoded.g.getTime())).toBe(true);
    expect(decoded.h).toStrictEqual(/\.x$/gi);
    expect(decoded.i()).toBe('called');
  });

  it('keeps holes of arrays as holes and key order as written', () => {
    const decoded = decode([1, { $$: 'hole' }, { $$: 'undefined' }, { z: 1, a: 2 }]);
    expect(decoded).toHaveLength(4);
    expect(1 in decoded).toBe(false);
    expect(2 in decoded).toBe(true);
    expect(Object.keys(decoded[3])).toEqual(['z', 'a']);
  });

  it('refuses a tag it does not know', () => {
    expect(() => decode({ $$: 'bigint' })).toThrow('unknown fixture tag: bigint');
  });
});

describe('fixture helpers', () => {
  it('captures a result or the thrown error', () => {
    expect(outcomeOf(() => 5)).toStrictEqual({ result: 5 });
    expect(outcomeOf(() => new Date(NaN).toISOString())).toStrictEqual({ throws: { name: 'RangeError', message: 'Invalid time value' } });
  });

  it('writes a date as its local-time fields, an Invalid Date as such', () => {
    expect(localTime(new Date(2021, 2, 4, 5, 6, 7, 8))).toBe('2021-03-04 05:06:07.008');
    expect(localTime(new Date(NaN))).toBe('Invalid Date');
  });

  it('localises ISO timestamps anywhere in a body and leaves other strings alone', () => {
    const iso = new Date(2021, 2, 4, 5, 6, 7).toISOString();
    expect(localizeDates({ a: [iso, 'text'], b: { c: iso, d: 1 } })).toEqual({ a: ['2021-03-04 05:06:07.000', 'text'], b: { c: '2021-03-04 05:06:07.000', d: 1 } });
  });
});
