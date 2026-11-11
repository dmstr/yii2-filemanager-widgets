import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFileManager, type FileManager } from '../../src/services/fileManager.ts';
import type { SelectEvent } from '../../src/services/fileManager/selection.ts';
import { legacyController } from '../utils/legacy.ts';
import { dir, file, flush, makeConfig, makeI18n, stubFetch } from './helpers.ts';

const config = makeConfig();
const raws = [file('a.txt'), dir('b'), file('c.png'), file('d.md'), dir('e'), file('f.zip')];

let fm: FileManager;
beforeEach(async () => {
  window.localStorage.clear();
  stubFetch(() => ({ body: { result: raws } }));
  fm = createFileManager(config, makeI18n());
  await fm.init();
});
afterEach(() => vi.unstubAllGlobals());

const names = (list: Array<{ model: { name: string } } | undefined>) => list.map((i) => (i ? i.model.name : undefined));
const event = (extra: Partial<SelectEvent> & { prevent?: boolean } = {}): SelectEvent => ({
  which: 1,
  target: { hasAttribute: (name: string) => !!extra.prevent && name === 'prevent' } as unknown as EventTarget,
  ...extra,
});

describe('selectOrUnselect gestures', () => {
  const click = (name: string, extra: Partial<SelectEvent> = {}) => fm.selectOrUnselect(fm.fileList.find((i) => i.model.name === name), event(extra));

  it('a plain click selects exactly that item', () => {
    click('a.txt');
    click('c.png');
    expect(names(fm.temps)).toEqual(['c.png']);
    expect(fm.isSelected(fm.fileList[2])).toBe(true);
    expect(fm.isSelected(fm.fileList[0])).toBe(false);
  });

  it('Ctrl and Cmd click add and remove', () => {
    click('a.txt');
    click('c.png', { ctrlKey: true });
    click('d.md', { metaKey: true });
    expect(names(fm.temps)).toEqual(['a.txt', 'c.png', 'd.md']);
    click('c.png', { ctrlKey: true });
    expect(names(fm.temps)).toEqual(['a.txt', 'd.md']);
  });

  it('Shift click selects the range from the first selected item, both directions', () => {
    click('b');
    click('d.md', { shiftKey: true });
    expect(names(fm.temps)).toEqual(['b', 'c.png', 'd.md']);
    click('e');
    click('a.txt', { shiftKey: true });
    expect(names(fm.temps)).toEqual(['e', 'd.md', 'c.png', 'b', 'a.txt']);
  });

  it('Shift click on the anchor itself, or without a selection, selects just the item', () => {
    click('b', { shiftKey: true });
    expect(names(fm.temps)).toEqual(['b']);
    click('b', { shiftKey: true });
    expect(names(fm.temps)).toEqual(['b']);
  });

  it('a right click on an unselected item selects it alone', () => {
    click('a.txt');
    click('c.png', { which: 3 });
    expect(names(fm.temps)).toEqual(['c.png']);
  });

  it('a right click on a selected item keeps a multi selection', () => {
    click('a.txt');
    click('c.png', { ctrlKey: true });
    click('a.txt', { which: 3 });
    expect(names(fm.temps)).toEqual(['a.txt', 'c.png']);
  });

  it('a right click ignores Ctrl and Shift', () => {
    click('a.txt');
    click('d.md', { which: 3, ctrlKey: true });
    expect(names(fm.temps)).toEqual(['d.md']);
    click('a.txt');
    click('d.md', { which: 3, shiftKey: true });
    expect(names(fm.temps)).toEqual(['d.md']);
  });

  it('an event on an element with the prevent attribute clears the selection, with or without an item', () => {
    click('a.txt');
    fm.selectOrUnselect(null, event({ prevent: true }));
    expect(fm.temps).toEqual([]);
    click('a.txt');
    fm.selectOrUnselect(fm.fileList[0], event({ prevent: true }));
    expect(fm.temps).toEqual([]);
  });

  it('a missing item changes nothing', () => {
    click('a.txt');
    fm.selectOrUnselect(null, event());
    fm.selectOrUnselect(undefined);
    expect(names(fm.temps)).toEqual(['a.txt']);
  });

  it('works without an event', () => {
    fm.selectOrUnselect(fm.fileList[1]);
    expect(names(fm.temps)).toEqual(['b']);
  });

  it('the range follows the displayed list: filtered and, in the table, sorted', async () => {
    fm.query = '.';
    click('a.txt');
    click('d.md', { shiftKey: true });
    expect(names(fm.temps)).toEqual(['a.txt', 'c.png', 'd.md']);
    fm.query = '';
    fm.setTemplate('main-table.html');
    fm.order('model.name');
    expect(names(fm.fileList)).toEqual(['f.zip', 'd.md', 'c.png', 'a.txt', 'e', 'b']);
    click('f.zip');
    click('c.png', { shiftKey: true });
    expect(names(fm.temps)).toEqual(['f.zip', 'd.md', 'c.png']);
  });

  it('keeps the hole of a shift range whose anchor is not in the displayed list, like the legacy code', () => {
    click('a.txt');
    fm.query = 'c';
    click('c.png', { shiftKey: true });
    expect(names(fm.temps)).toEqual([undefined, 'c.png']);
    expect(fm.totalSelecteds().total).toBe(2);
    expect(fm.singleSelection()).toBeUndefined();
    expect(fm.selectionHas('dir')).toBeUndefined();
    expect(fm.selectionHas('file')?.model.name).toBe('c.png');
  });
});

describe('selection gestures equal the legacy controller', () => {
  /** A seeded random walk over all gesture kinds, compared step by step. */
  it.each([1, 2, 3, 4, 5])('random sequence %i', (seed) => {
    const { $scope, Item } = legacyController(config);
    const oldItems = raws.map((raw) => new Item(raw, []));
    $scope.fileList = oldItems;
    $scope.$digest();
    for (const item of [...oldItems, ...fm.fileList]) item.tempModel.name = 'dirty-' + item.model.name;

    let state = seed * 7919;
    const next = (limit: number) => ((state = (state * 1103515245 + 12345) & 0x7fffffff), state % limit);

    for (let step = 0; step < 400; step++) {
      const index = next(raws.length + 1);
      const kind = next(8);
      const ev: Partial<SelectEvent> & { prevent?: boolean } = {};
      if (kind === 1) ev.ctrlKey = true;
      if (kind === 2) ev.metaKey = true;
      if (kind === 3) ev.shiftKey = true;
      if (kind === 4) ev.which = 3;
      if (kind === 5) (ev.which = 3), (ev.ctrlKey = true);
      if (kind === 6) (ev.which = 3), (ev.shiftKey = true);
      if (kind === 7 && index === raws.length) ev.prevent = true;
      const e = event(ev);

      $scope.selectOrUnselect(index === raws.length ? null : oldItems[index], e);
      $scope.$digest();
      fm.selectOrUnselect(index === raws.length ? null : fm.fileList[index], e);

      const label = `seed ${seed} step ${step}`;
      expect(names(fm.temps), label).toEqual(names($scope.temps));
      expect(fm.fileList.map((i) => fm.isSelected(i)), label).toEqual(oldItems.map((i) => $scope.isSelected(i)));
      // The watcher reverts a single selected item's tempModel: same visible effect.
      expect(fm.fileList.map((i) => i.tempModel.name), label).toEqual(oldItems.map((i) => i.tempModel.name));
      expect(fm.singleSelection()?.model.name, label).toEqual($scope.singleSelection() ? $scope.singleSelection().model.name : undefined);
      // Dirty the inputs again so every replacement shows up as a revert.
      for (const item of [...oldItems, ...fm.fileList]) item.tempModel.name = 'dirty-' + item.model.name;
    }
  });

  it('totalSelecteds, selectionHas and singleSelection', () => {
    const { $scope, Item } = legacyController(config);
    const oldItems = raws.map((raw) => new Item(raw, []));
    $scope.fileList = oldItems;
    for (const i of [0, 1]) {
      $scope.selectOrUnselect(oldItems[i], { ctrlKey: true, target: { hasAttribute: () => false } });
      fm.selectOrUnselect(fm.fileList[i], event({ ctrlKey: true }));
    }
    expect(fm.totalSelecteds()).toEqual($scope.totalSelecteds());
    expect(!!fm.selectionHas('dir')).toBe(!!$scope.selectionHas('dir'));
    expect(!!fm.selectionHas('nope')).toBe(!!$scope.selectionHas('nope'));
    expect(!!fm.singleSelection()).toBe(!!$scope.singleSelection());
  });
});

describe('temp (Q-25)', () => {
  it('is the single selected item', () => {
    fm.selectOrUnselect(fm.fileList[0]);
    expect(fm.temp).toBe(fm.singleSelection());
  });

  it('is a fresh multiple placeholder with rights 644 otherwise, following every selection change', () => {
    expect(fm.temp.model.perms.toCode()).toBe('rw-r--r--');
    expect((fm.temp as { multiple?: boolean }).multiple).toBe(true);
    fm.selectOrUnselect(fm.fileList[0]);
    fm.selectOrUnselect(fm.fileList[1], event({ ctrlKey: true }));
    const placeholder = fm.temp;
    expect((placeholder as { multiple?: boolean }).multiple).toBe(true);
    expect(placeholder.tempModel.name).toBe('');
    placeholder.tempModel.name = 'archive';
    expect(fm.temp.tempModel.name).toBe('archive');
    fm.selectOrUnselect(fm.fileList[2], event({ ctrlKey: true }));
    expect(fm.temp.tempModel.name).toBe('');
  });

  it('the placeholder becomes the item again when the selection drops back to one', () => {
    fm.selectOrUnselect(fm.fileList[0]);
    fm.selectOrUnselect(fm.fileList[1], event({ ctrlKey: true }));
    fm.selectOrUnselect(fm.fileList[1], event({ ctrlKey: true }));
    expect(fm.temp).toBe(fm.fileList[0]);
  });
});

describe('revert on replacement (legacy $watch)', () => {
  it('drops dialog input when the same item is selected again, but not on Ctrl-click additions', () => {
    fm.selectOrUnselect(fm.fileList[0]);
    fm.fileList[0].tempModel.name = 'typed';
    fm.selectOrUnselect(fm.fileList[1], event({ ctrlKey: true }));
    expect(fm.fileList[0].tempModel.name).toBe('typed');
    fm.selectOrUnselect(fm.fileList[1], event({ ctrlKey: true }));
    expect(fm.fileList[0].tempModel.name).toBe('typed');
    fm.selectOrUnselect(fm.fileList[0]);
    expect(fm.fileList[0].tempModel.name).toBe('a.txt');
  });

  it('clears the item error on revert', () => {
    fm.fileList[0].error = 'boom';
    fm.selectOrUnselect(fm.fileList[0]);
    expect(fm.fileList[0].error).toBe('');
  });
});

describe('prepareNewFolder (Q-26)', () => {
  it('selects a phantom item that is not in the list and stays selected', async () => {
    const item = fm.prepareNewFolder();
    expect(fm.singleSelection()).toBe(item);
    expect(fm.fileList).not.toContain(item);
    expect(item.model.type).toBe('file');
    expect(item.model.name).toBe('');
    expect(item.model.path).toEqual([]);
    fm.modal('newfolder', true);
    expect(fm.singleSelection()).toBe(item);
    await flush();
  });

  it('takes the current path of the navigator', async () => {
    stubFetch(() => ({ body: { result: [dir('sub')] } }));
    fm.navigator.currentPath = ['x', 'y'];
    expect(fm.prepareNewFolder().model.path).toEqual(['x', 'y']);
    await flush();
  });
});
