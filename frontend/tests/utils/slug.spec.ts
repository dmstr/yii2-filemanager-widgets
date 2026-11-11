import { describe, expect, it } from 'vitest';
import { slug } from '../../src/utils/slug.ts';
import { loadFixture, outcomeOf, type Outcome } from './fixtures.ts';

/** Recorded calls of the slug function of the AngularJS 1.x frontend: the input and what it returned. */
const recorded = loadFixture<Array<{ input: unknown } & Outcome>>('utils/slug.json');

describe('slug', () => {
  it('matches the recorded results over a table of inputs', () => {
    expect(recorded).toHaveLength(16);
    for (const row of recorded) {
      expect(outcomeOf(() => slug(row.input)), String(row.input)).toStrictEqual('throws' in row ? { throws: row.throws } : { result: row.result });
    }
  });

  it('lowercases and collapses everything outside a-z0-9-', () => {
    expect(slug(' New Folder! ')).toBe('new-folder');
    expect(slug('')).toBe('');
  });
});
