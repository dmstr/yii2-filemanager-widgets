/**
 * Reader for the recorded fixtures in `tests/fixtures/` (see the README there).
 *
 * The files are plain JSON. A value JSON cannot represent is stored as an
 * object with a `$$` key and rebuilt by `decode`:
 *
 *   {"$$": "undefined"}                         undefined
 *   {"$$": "number", "value": "NaN"}            NaN, "Infinity", "-Infinity" or "-0"
 *   {"$$": "Date", "iso": "2021-03-04T..."}     a Date; "iso": null is an Invalid Date
 *   {"$$": "RegExp", "source": "a", "flags": "i"}
 *   {"$$": "function", "returns": <value>}      a function that returns the (decoded) value
 *   {"$$": "hole"}                              inside an array: a hole, not undefined
 *
 * Key order of objects is kept, as `JSON.parse` keeps it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fixturesDir = resolve(__dirname, '../fixtures') + '/';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const isTagged = (value: unknown): value is { $$: string } =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && '$$' in value;

/** Rebuilds the values that were stored as `$$` objects; everything else is returned as parsed. */
export function decode(value: unknown): Any {
  if (Array.isArray(value)) {
    const out: unknown[] = new Array(value.length);
    value.forEach((entry, index) => {
      if (!(isTagged(entry) && entry.$$ === 'hole')) out[index] = decode(entry);
    });
    return out;
  }
  if (isTagged(value)) {
    const tagged = value as Any;
    switch (tagged.$$) {
      case 'undefined':
        return undefined;
      case 'number':
        return Number(tagged.value);
      case 'Date':
        return new Date(tagged.iso === null ? NaN : tagged.iso);
      case 'RegExp':
        return new RegExp(tagged.source, tagged.flags);
      case 'function': {
        const returns = decode(tagged.returns);
        return () => returns;
      }
      default:
        throw new Error(`unknown fixture tag: ${tagged.$$}`);
    }
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, decode(entry)]));
  }
  return value;
}

/** A fixture file below `tests/fixtures/`, decoded. */
export function loadFixture<T = Any>(name: string): T {
  return decode(JSON.parse(readFileSync(fixturesDir + name, 'utf8')));
}

/** A fixture file below `tests/fixtures/` as text (the recorded HTML templates). */
export function loadFixtureText(name: string): string {
  return readFileSync(fixturesDir + name, 'utf8');
}

/** What a recorded call produced: its return value, or the error it threw. */
export type Outcome = { result: unknown } | { throws: { name: string; message: string } };

/** Runs `fn` and captures its outcome in the shape the fixtures use for a recorded call. */
export function outcomeOf(fn: () => unknown): Outcome {
  try {
    return { result: fn() };
  } catch (error) {
    return { throws: { name: (error as Error).name, message: (error as Error).message } };
  }
}

/**
 * A date as its local-time fields, the form in which the fixtures record dates that
 * were parsed as local time: the instant would differ between time zones, the fields do not.
 */
export function localTime(date: Date): string {
  if (Number.isNaN(date.getTime())) return 'Invalid Date';
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

const isoUtc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * A request body with every ISO timestamp string replaced by its local-time fields (`localTime`).
 * An item parses its MySQL date as local time, so the timestamp it serialises depends on the time
 * zone; the local fields do not.
 */
export function localizeDates(value: Any): Any {
  if (typeof value === 'string') return isoUtc.test(value) ? localTime(new Date(value)) : value;
  if (Array.isArray(value)) return value.map(localizeDates);
  if (typeof value === 'object' && value !== null) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, localizeDates(entry)]));
  return value;
}
