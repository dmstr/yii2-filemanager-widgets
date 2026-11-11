import { describe, expect, it } from 'vitest';
import { slug } from '../../src/utils/slug.ts';
import { legacySlug } from './legacy.ts';

const legacy = legacySlug();

describe('slug', () => {
  const inputs: unknown[] = [
    '',
    '  ',
    'New Folder',
    '  Trim me  ',
    'Ünïcödé Näme',
    '--a--b--',
    'a  b',
    'A_B.c',
    'UPPER-lower-123',
    ' nbsp ',
    '﻿feff',
    'tab\tname',
    '/..//etc',
    null,
    undefined,
    123,
  ];

  it('matches the legacy slug over a table of inputs', () => {
    for (const input of inputs) {
      expect(slug(input), String(input)).toBe(legacy(input));
    }
  });

  it('lowercases and collapses everything outside a-z0-9-', () => {
    expect(slug(' New Folder! ')).toBe('new-folder');
    expect(slug('')).toBe('');
  });
});
