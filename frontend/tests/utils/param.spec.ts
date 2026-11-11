import { describe, expect, it } from 'vitest';
import { param } from '../../src/utils/param.ts';
import { angularGlobal } from './legacy.ts';

const jq = () => (angularGlobal(), (window as unknown as { jQuery: { param(data: unknown): string } }).jQuery);

const table: Array<[string, unknown]> = [
  ['flat strings', { action: 'download', path: '/a/b.txt' }],
  ['spaces', { path: '/my folder/a b.txt' }],
  ['reserved characters', { path: "/a&b=c?d#e+f%g/ü ß 'x' (y)*!~" }],
  ['unicode', { path: '/日本語/ファイル.txt' }],
  ['array of strings', { action: 'downloadMultiple', items: ['/a.txt', '/b c.txt'], toFilename: '12345-x.zip' }],
  ['empty array', { items: [] }],
  ['empty string', { path: '' }],
  ['undefined and null values', { a: undefined, b: null, c: 'x' }],
  ['numbers and booleans', { n: 1, f: 1.5, t: true, z: 0 }],
  ['array with undefined', { items: ['/a', undefined] }],
  ['nested object', { a: { b: 'c', d: ['e', 'f'] } }],
  ['array of objects', { a: [{ b: 1 }, { c: 2 }] }],
  ['function value', { a: () => 'called' }],
  ['key needing encoding', { 'a b&c': 'x' }],
  ['empty object', {}],
];

describe('param', () => {
  it.each(table)('matches jQuery 3 for %s', (_name, data) => {
    expect(param(data as Record<string, unknown>)).toBe(jq().param(data));
  });

  it('encodes array keys as items%5B%5D', () => {
    expect(param({ items: ['a', 'b'] })).toBe('items%5B%5D=a&items%5B%5D=b');
  });

  it('keeps spaces as %20 like jQuery 3 does (the brief expected +)', () => {
    expect(param({ a: 'b c' })).toBe('a=b%20c');
  });

  it('matches jQuery for the name/value array form and for null input', () => {
    const pairs = [{ name: 'a', value: '1 2' }, { name: 'b', value: undefined }];
    expect(param(pairs)).toBe(jq().param(pairs));
    expect(param(null)).toBe(jq().param(null));
    expect(param(undefined)).toBe(jq().param(undefined));
  });
});
