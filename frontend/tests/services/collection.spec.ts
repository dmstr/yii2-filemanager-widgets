import { describe, expect, it } from 'vitest';
import { filterBy, filterByName, orderBy } from '../../src/services/fileManager/collection.ts';
import { makeItem } from './helpers.ts';
import { loadFixture } from '../utils/fixtures.ts';

/** What `filter` and `orderBy` of AngularJS 1.5.11 returned for these items; orderings are lists of positions in `items`. */
const recorded = loadFixture<{
  items: Parameters<typeof makeItem>[0][];
  filter: Array<{ query: unknown; names: string[] }>;
  filterExpression: { expression: object; names: string[] };
  orderBy: Array<{ label: string; predicate: string[]; reverse: boolean; indices: number[] }>;
  orderByArrays: Array<{ predicate: string[]; byReverse: Array<{ reverse: boolean; indices: number[] }> }>;
  orderBySingle: { predicate: string; indices: number[] };
  orderByFunction: { predicate: string; reverse: boolean; indices: number[] };
}>('services/collection.json');

const items = recorded.items.map((raw) => makeItem(raw));
const names = (list: Array<{ model: { name: string; size?: number | null } }>) => list.map((i) => i.model.name + ':' + i.model.size);

describe('filterByName matches the recorded AngularJS filter', () => {
  it.each(recorded.filter.map((row) => [String(row.query), row] as const))('query %s', (_label, row) => {
    expect(names(filterByName(items, row.query))).toEqual(row.names);
  });

  it('is a case-insensitive substring match', () => {
    expect(filterByName(items, 'TxT').map((i) => i.model.name)).toEqual(['b.txt', 'a.TXT', 'b.txt']);
  });

  it('negates with a leading !', () => {
    expect(filterByName(items, '!a')).toHaveLength(items.filter((i) => !i.model.name.toLowerCase().includes('a')).length);
  });

  it('works on other expression shapes like the original', () => {
    expect(names(filterBy(items, recorded.filterExpression.expression))).toEqual(recorded.filterExpression.names);
  });
});

describe('orderBy matches the recorded AngularJS orderBy', () => {
  // Positions, not just names: ties must land on the same items.
  const positions = (list: typeof items) => list.map((i) => items.indexOf(i));

  it.each(recorded.orderBy.map((row) => [row.label, row] as const))('%s', (_label, row) => {
    expect(positions(orderBy(items, row.predicate, row.reverse))).toEqual(row.indices);
  });

  it.each(recorded.orderByArrays.map((row) => [row.predicate, row] as const))('predicate array %j', (_predicate, row) => {
    for (const { reverse, indices } of row.byReverse) {
      expect(positions(orderBy(items, row.predicate, reverse))).toEqual(indices);
    }
  });

  it('accepts a single string and a function predicate', () => {
    expect(positions(orderBy(items, recorded.orderBySingle.predicate))).toEqual(recorded.orderBySingle.indices);
    expect(recorded.orderByFunction.predicate).toBe('nameLength');
    const byLength = (i: (typeof items)[number]) => i.model.name.length;
    expect(positions(orderBy(items, byLength, recorded.orderByFunction.reverse))).toEqual(recorded.orderByFunction.indices);
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
