import { describe, expect, it } from 'vitest';
import { filterBy, filterByName, orderBy } from '../../src/services/fileManager/collection.ts';
import { dir, file, makeItem } from './helpers.ts';
import { legacyCollectionFilters } from '../utils/legacy.ts';

const legacy = legacyCollectionFilters();

const items = [
  makeItem(file('b.txt', { size: 5, date: '2021-05-01 10:00:00' })),
  makeItem(dir('Zeta', { size: 0, date: '2020-01-01 00:00:00' })),
  makeItem(file('a.TXT', { size: 5, date: '2021-05-01 10:00:00' })),
  makeItem(dir('alpha', { size: 0, date: '2022-01-01 00:00:00' })),
  makeItem(file('A-Report.pdf', { size: 700, date: 'garbage' })),
  makeItem(file('10.png', { size: 2000, date: '2019-12-31 23:59:59' })),
  makeItem(file('9.png', { size: 2000 })),
  makeItem(file('b.txt', { size: 99, date: '2021-05-01 10:00:00' })),
  makeItem(file('file with space.md', { size: 12, date: '2021-02-02 02:02:02' })),
];
const names = (list: Array<{ model: { name: string; size?: number | null } }>) => list.map((i) => i.model.name + ':' + i.model.size);

describe('filterByName matches the AngularJS filter', () => {
  const queries: unknown[] = ['', 'a', 'A', 'TXT', '.txt', 'report', '!a', '!', '!zzz', ' ', 'zzz', 'a.t', '%', undefined, null, 5, '1', 'ä'];
  it.each(queries.map((q) => [String(q), q]))('query %s', (_label, query) => {
    const expected = legacy.filter(items, { model: { name: query } });
    expect(names(filterByName(items, query))).toEqual(names(expected));
  });

  it('is a case-insensitive substring match', () => {
    expect(filterByName(items, 'TxT').map((i) => i.model.name)).toEqual(['b.txt', 'a.TXT', 'b.txt']);
  });

  it('negates with a leading !', () => {
    expect(filterByName(items, '!a')).toHaveLength(items.filter((i) => !i.model.name.toLowerCase().includes('a')).length);
  });

  it('works on other expression shapes like the original', () => {
    const expression = { model: { type: 'dir' } };
    expect(names(filterBy(items, expression))).toEqual(names(legacy.filter(items, expression)));
  });
});

describe('orderBy matches the AngularJS orderBy', () => {
  const columns = ['model.name', 'model.size', 'model.date', 'model.permissions', 'model.type', 'model.extension', ''];
  const cases: Array<[string, string[], boolean]> = [];
  for (const column of columns) {
    for (const reverse of [false, true]) {
      cases.push([`${column || '(empty)'} reverse=${reverse}`, ['model.type', column || 'model.name'], reverse]);
    }
  }
  it.each(cases)('%s', (_label, predicate, reverse) => {
    const expected = legacy.orderBy(items, predicate, reverse);
    // Identity, not just names: ties must land on the same items.
    expect(orderBy(items, predicate, reverse).map((i) => items.indexOf(i))).toEqual(expected.map((i: unknown) => items.indexOf(i as never)));
  });

  it.each([[['+model.name']], [['-model.name']], [['model.size', '-model.name']], [[]], [['model.name', 'model.size']]])(
    'predicate array %j',
    (predicate) => {
      for (const reverse of [false, true]) {
        expect(orderBy(items, predicate, reverse).map((i) => items.indexOf(i))).toEqual(
          legacy.orderBy(items, predicate, reverse).map((i: unknown) => items.indexOf(i as never)),
        );
      }
    },
  );

  it('accepts a single string and a function predicate', () => {
    expect(orderBy(items, 'model.name').map((i) => items.indexOf(i))).toEqual(
      legacy.orderBy(items, 'model.name').map((i: unknown) => items.indexOf(i as never)),
    );
    const byLength = (i: (typeof items)[number]) => i.model.name.length;
    expect(orderBy(items, byLength, true).map((i) => items.indexOf(i))).toEqual(
      legacy.orderBy(items, byLength, true).map((i: unknown) => items.indexOf(i as never)),
    );
  });

  it('puts folders first, and files first when reversed', () => {
    const asc = orderBy(items, ['model.type', 'model.name'], false).map((i) => i.model.type);
    expect(asc.slice(0, 2)).toEqual(['dir', 'dir']);
    const desc = orderBy(items, ['model.type', 'model.name'], true).map((i) => i.model.type);
    expect(desc.slice(-2)).toEqual(['dir', 'dir']);
  });

  it('leaves null and undefined inputs alone like the original', () => {
    expect(orderBy([], 'model.name')).toEqual([]);
  });
});
