import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFileManager, type FileManager } from '../../src/services/fileManager.ts';
import type { SelectEvent } from '../../src/services/fileManager/selection.ts';
import { loadFixture } from '../utils/fixtures.ts';
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
    expect(fm.isSelected(fm.fileList.find((i) => i.model.name === 'c.png'))).toBe(true);
    expect(fm.isSelected(fm.fileList.find((i) => i.model.name === 'a.txt'))).toBe(false);
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
    // The displayed order is folders first, then by name: b, e, a.txt, c.png, d.md, f.zip.
    click('b');
    click('c.png', { shiftKey: true });
    expect(names(fm.temps)).toEqual(['b', 'e', 'a.txt', 'c.png']);
    click('d.md');
    click('e', { shiftKey: true });
    expect(names(fm.temps)).toEqual(['d.md', 'c.png', 'a.txt', 'e']);
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
    expect(names(fm.temps)).toEqual(['e']);
  });

  it('the range follows the displayed list: filtered and sorted, in every view', async () => {
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
    fm.setTemplate('main-icons.html');
    click('f.zip');
    click('c.png', { shiftKey: true });
    expect(names(fm.temps)).toEqual(['f.zip', 'd.md', 'c.png']);
  });

  it('keeps the hole of a shift range whose anchor is not in the displayed list, like the AngularJS code', () => {
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

describe('selection gestures', () => {
  const recorded = loadFixture<{
    summary: { selectedIndexes: number[]; totalSelecteds: unknown; hasDir: boolean; hasNope: boolean; hasSingleSelection: boolean };
  }>('services/selection.json');

  /**
   * Q-23: the five recorded random walks of the AngularJS controller ran on the unsorted
   * backend order of an icon view, and a shift range depends on the displayed order, so
   * they no longer apply. This sequence covers the same gesture kinds on the new order
   * (b, e, a.txt, c.png, d.md, f.zip), identical in all three views.
   */
  it.each(['main-icons.html', 'main-icons-preview.html', 'main-table.html'] as const)('a mixed gesture sequence in %s', (view) => {
    fm.setTemplate(view);
    expect(names(fm.fileList)).toEqual(['b', 'e', 'a.txt', 'c.png', 'd.md', 'f.zip']);
    const gesture = (index: number | null, extra: Partial<SelectEvent> & { prevent?: boolean } = {}) =>
      fm.selectOrUnselect(index === null ? null : fm.fileList[index], event(extra));
    const selected = () => fm.fileList.map((i) => (fm.isSelected(i) ? '1' : '0')).join('');
    const dirty = () => fm.fileList.forEach((i) => (i.tempModel.name = 'dirty-' + i.model.name));
    const reverted = () => fm.fileList.filter((i) => i.tempModel.name === i.model.name).map((i) => i.model.name);

    dirty();
    gesture(2);
    expect(names(fm.temps)).toEqual(['a.txt']);
    expect(reverted()).toEqual(['a.txt']);
    gesture(4, { shiftKey: true });
    expect(names(fm.temps)).toEqual(['a.txt', 'c.png', 'd.md']);
    expect(selected()).toBe('001110');
    gesture(0, { ctrlKey: true });
    expect(names(fm.temps)).toEqual(['a.txt', 'c.png', 'd.md', 'b']);
    gesture(3, { metaKey: true });
    expect(names(fm.temps)).toEqual(['a.txt', 'd.md', 'b']);
    gesture(5, { shiftKey: true });
    expect(names(fm.temps)).toEqual(['a.txt', 'c.png', 'd.md', 'f.zip']);
    dirty();
    gesture(1, { which: 3 });
    expect(names(fm.temps)).toEqual(['e']);
    expect(reverted()).toEqual(['e']);
    gesture(1, { which: 3 });
    expect(names(fm.temps)).toEqual(['e']);
    gesture(0, { metaKey: true });
    expect(names(fm.temps)).toEqual(['e', 'b']);
    gesture(3, { shiftKey: true });
    expect(names(fm.temps)).toEqual(['e', 'a.txt', 'c.png']);
    expect(fm.singleSelection()).toBeUndefined();
    gesture(null, { prevent: true });
    expect(fm.temps).toEqual([]);
    gesture(null);
    expect(fm.temps).toEqual([]);
  });

  it('totalSelecteds, selectionHas and singleSelection', () => {
    for (const i of recorded.summary.selectedIndexes) fm.selectOrUnselect(fm.fileList[i], event({ ctrlKey: true }));
    expect(fm.totalSelecteds()).toEqual(recorded.summary.totalSelecteds);
    expect(!!fm.selectionHas('dir')).toBe(recorded.summary.hasDir);
    expect(!!fm.selectionHas('nope')).toBe(recorded.summary.hasNope);
    expect(!!fm.singleSelection()).toBe(recorded.summary.hasSingleSelection);
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

describe('revert on replacement (the AngularJS $watch)', () => {
  it('drops dialog input when the same item is selected again, but not on Ctrl-click additions', () => {
    fm.selectOrUnselect(fm.fileList[0]);
    fm.fileList[0].tempModel.name = 'typed';
    fm.selectOrUnselect(fm.fileList[1], event({ ctrlKey: true }));
    expect(fm.fileList[0].tempModel.name).toBe('typed');
    fm.selectOrUnselect(fm.fileList[1], event({ ctrlKey: true }));
    expect(fm.fileList[0].tempModel.name).toBe('typed');
    fm.selectOrUnselect(fm.fileList[0]);
    expect(fm.fileList[0].tempModel.name).toBe('b');
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
