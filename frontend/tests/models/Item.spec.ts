import { describe, expect, it } from 'vitest';
import { isReactive, reactive } from 'vue';
import { createDefaults } from '../../src/config/defaults.ts';
import { Item, type RawItem } from '../../src/models/Item.ts';
import { loadFixture, localTime } from '../utils/fixtures.ts';

const config = createDefaults();
const make = (raw: RawItem | null | undefined, path?: string[], cfg = config) => new Item(raw, path, cfg);

const fileflyEntry: RawItem = {
  name: 'photo.JPG',
  thumbnail: '/t/photo.jpg',
  preview: '/p/photo.jpg',
  urls: { download: '/d', stream: '/s' },
  extension: 'jpg',
  type: 'file',
  size: '2048',
  date: '2021-03-04 05:06:07',
  rights: 'rw-r--r--',
  content: 'abc',
};

describe('Item construction', () => {
  it('uses the defaults of the AngularJS factory for an empty model', () => {
    const item = make({}, []);
    expect(item.model).toMatchObject({ name: '', thumbnail: '', preview: '', urls: [], extension: '', path: [], type: 'file', size: 0, content: '' });
    expect(item.model.perms.toCode()).toBe('---------');
    expect(item.error).toBe('');
    expect(item.processing).toBe(false);
  });

  it('has an Invalid Date when the model carries no date', () => {
    expect(Number.isNaN(make({}).model.date.getTime())).toBe(true);
    expect(Number.isNaN(make(null).model.date.getTime())).toBe(true);
  });

  it('has an Invalid Date for a date-only value (the time parts are missing)', () => {
    expect(Number.isNaN(make({ date: '2021-03-04' }).model.date.getTime())).toBe(true);
  });

  it('parses a MySQL date as local time', () => {
    const date = make(fileflyEntry).model.date;
    expect(date.getTime()).toBe(new Date(2021, 2, 4, 5, 6, 7).getTime());
  });

  it('takes every field of a full filefly list entry', () => {
    const item = make(fileflyEntry, ['a', 'b']);
    expect(item.model).toMatchObject({
      name: 'photo.JPG',
      thumbnail: '/t/photo.jpg',
      preview: '/p/photo.jpg',
      urls: { download: '/d', stream: '/s' },
      extension: 'jpg',
      path: ['a', 'b'],
      type: 'file',
      size: 2048,
      content: 'abc',
    });
    expect(item.model.perms.toCode()).toBe('rw-r--r--');
  });

  it('keeps the size of the AngularJS factory for a missing raw model', () => {
    expect(make(null).model.size).toBeNull();
    expect(make(undefined).model.size).toBeUndefined();
  });

  it('parses the size like parseInt', () => {
    expect(make({ size: '12abc' }).model.size).toBe(12);
    expect(make({ size: 'abc' }).model.size).toBeNaN();
    expect(make({ size: 1.9 }).model.size).toBe(1);
  });

  it('throws for invalid rights like the chmod service does', () => {
    expect(() => make({ rights: 'nope' })).toThrow('Invalid chmod input data (nope)');
  });

  it('does not carry the members dropped from the AngularJS factory', () => {
    const item = make(fileflyEntry) as unknown as Record<string, unknown>;
    expect(item.update).toBeUndefined();
    expect(item.isCompressible).toBeUndefined();
    expect(Object.keys(item.model as object)).not.toContain('recursive');
    expect(Object.keys(item.model as object)).not.toContain('dirName');
  });
});

describe('model and tempModel', () => {
  it('are independent deep copies', () => {
    const path = ['a'];
    const item = make(fileflyEntry, path);
    expect(item.tempModel).toEqual(item.model);
    expect(item.tempModel).not.toBe(item.model);
    expect(item.tempModel.perms).not.toBe(item.model.perms);
    expect(item.tempModel.path).not.toBe(item.model.path);
    expect(item.tempModel.path).not.toBe(path);
    expect(item.tempModel.date).not.toBe(item.model.date);
    expect(item.tempModel.urls).not.toBe(item.model.urls);
    item.tempModel.path.push('b');
    item.tempModel.perms.owner.exec = true;
    expect(item.model.path).toEqual(['a']);
    expect(item.model.perms.owner.exec).toBe(false);
  });

  it('each have their own fullPath() bound to their own data', () => {
    const item = make({ name: 'x' }, ['a']);
    item.tempModel.name = 'renamed';
    expect(item.model.fullPath()).toBe('/a/x');
    expect(item.tempModel.fullPath()).toBe('/a/renamed');
  });

  it('revert() restores tempModel from model and clears the error', () => {
    const item = make(fileflyEntry, ['a']);
    item.tempModel.name = 'changed';
    item.tempModel.perms.owner.exec = true;
    item.error = 'boom';
    item.revert();
    expect(item.tempModel.name).toBe('photo.JPG');
    expect(item.tempModel.perms.owner.exec).toBe(false);
    expect(item.tempModel.perms.toCode()).toBe('rw-r--r--');
    expect(item.error).toBe('');
  });

  it('revert() copies permission fields added later and keeps extra tempModel members', () => {
    const item = make({});
    item.model.authRead = [{ role: 'Admin', selected: true }];
    item.tempModel.authUpdate = [{ role: 'Editor', selected: false }];
    item.revert();
    expect(item.tempModel.authRead).toEqual([{ role: 'Admin', selected: true }]);
    expect(item.tempModel.authRead).not.toBe(item.model.authRead);
    expect(item.tempModel.authUpdate).toEqual([{ role: 'Editor', selected: false }]);
  });
});

describe('fullPath()', () => {
  const full = (path: string[] | undefined, name: string) => make({ name }, path).model.fullPath();

  it('builds the root path', () => {
    expect(full([], 'file.txt')).toBe('/file.txt');
    expect(full(undefined, 'file.txt')).toBe('/file.txt');
    expect(full([], '')).toBe('/');
  });

  it('builds nested paths', () => {
    expect(full(['a', 'b'], 'file.txt')).toBe('/a/b/file.txt');
  });

  it('drops empty path segments', () => {
    expect(full(['', 'a', '', 'b'], 'x')).toBe('/a/b/x');
    expect(full([''], 'x')).toBe('/x');
  });

  it('only collapses the first double slash', () => {
    expect(full(['a/', 'b/'], 'x')).toBe('/a/b//x');
    expect(full([], '/x')).toBe('//x');
    expect(full([], '//x')).toBe('///x');
  });
});

describe('predicates', () => {
  it('isFolder() looks at the model type', () => {
    expect(make({ type: 'dir' }).isFolder()).toBe(true);
    expect(make({ type: 'file' }).isFolder()).toBe(false);
    expect(make({}).isFolder()).toBe(false);
  });

  it('isImage() uses the configured pattern on the name, folders included', () => {
    expect(make({ name: 'a.PNG' }).isImage()).toBe(true);
    expect(make({ name: 'a.txt' }).isImage()).toBe(false);
    expect(make({ name: 'pic.png', type: 'dir' }).isImage()).toBe(true);
  });

  it('isEditable() needs a file and a matching name', () => {
    expect(make({ name: 'a.txt' }).isEditable()).toBe(true);
    expect(make({ name: 'a.txt', type: 'dir' }).isEditable()).toBe(false);
    expect(make({ name: 'a.bin' }).isEditable()).toBe(false);
  });

  it('isExtractable() needs a file and a matching name', () => {
    expect(make({ name: 'a.tar' }).isExtractable()).toBe(true);
    expect(make({ name: 'a.zip', type: 'dir' }).isExtractable()).toBe(false);
    expect(make({ name: 'a.txt' }).isExtractable()).toBe(false);
  });

  it('isSelectable() follows pickFiles and pickFolders', () => {
    const cfg = createDefaults();
    expect(make({ type: 'dir' }, [], cfg).isSelectable()).toBe(false);
    expect(make({}, [], cfg).isSelectable()).toBe(false);
    cfg.allowedActions.pickFolders = true;
    expect(make({ type: 'dir' }, [], cfg).isSelectable()).toBe(true);
    expect(make({}, [], cfg).isSelectable()).toBe(false);
    cfg.allowedActions.pickFiles = true;
    expect(make({}, [], cfg).isSelectable()).toBe(true);
  });

  it('read the config they were given, not a global', () => {
    const cfg = createDefaults();
    cfg.isImageFilePattern = /\.zzz$/;
    expect(make({ name: 'a.zzz' }, [], cfg).isImage()).toBe(true);
    expect(make({ name: 'a.png' }, [], cfg).isImage()).toBe(false);
  });
});

describe('reactive()', () => {
  it('works on instances: methods, nested models and fullPath()', () => {
    const item = reactive(make(fileflyEntry, ['a']));
    expect(isReactive(item.model)).toBe(true);
    expect(item.isImage()).toBe(true);
    expect(item.model.fullPath()).toBe('/a/photo.JPG');
    item.tempModel.name = 'x';
    expect(item.tempModel.fullPath()).toBe('/a/x');
    item.revert();
    expect(item.tempModel.name).toBe('photo.JPG');
  });

  it('compares by identity inside reactive arrays', () => {
    const a = make({ name: 'a' });
    const b = make({ name: 'b' });
    const selection = reactive([a, b]);
    expect(selection.includes(selection[0])).toBe(true);
    expect(selection.indexOf(selection[1])).toBe(1);
    // Vue unwraps for includes/indexOf, so the raw item is found too.
    expect(selection.includes(a)).toBe(true);
  });

  it('keeps Date and Chmod usable through the proxy', () => {
    const item = reactive(make(fileflyEntry));
    expect(item.model.date.getFullYear()).toBe(2021);
    expect(item.model.perms.toCode()).toBe('rw-r--r--');
    item.tempModel.perms.owner.exec = true;
    expect(item.tempModel.perms.toCode()).toBe('rwxr--r--');
    expect(item.model.perms.toCode()).toBe('rw-r--r--');
  });
});

describe('recorded results of the AngularJS factory', () => {
  /** What the `item` factory of the AngularJS 1.x frontend built for each raw model and path of the table. */
  interface RecordedModel {
    name: string;
    urls: unknown;
    path: string[];
    type: string;
    size: unknown;
    /** The date as its local-time fields. */
    date: string;
    perms: string;
    fullPath: string;
  }
  const recorded = loadFixture<{
    raws: (RawItem | null | undefined)[];
    paths: (string[] | undefined)[];
    results: Array<
      Array<{ model: RecordedModel; tempModel: RecordedModel } & Record<'isFolder' | 'isEditable' | 'isImage' | 'isExtractable' | 'isSelectable', boolean>>
    >;
  }>('models/item.json');

  it('produces the same models and predicate results', () => {
    expect(recorded.raws).toHaveLength(7);
    expect(recorded.paths).toHaveLength(5);
    recorded.raws.forEach((raw, rawIndex) => {
      recorded.paths.forEach((path, pathIndex) => {
        const expected = recorded.results[rawIndex][pathIndex];
        const item = make(raw, path);
        const label = JSON.stringify([raw, path]);
        for (const key of ['model', 'tempModel'] as const) {
          const l = expected[key];
          const m = item[key];
          expect(m.name, label).toBe(l.name);
          expect(m.urls, label).toEqual(l.urls);
          expect(m.path, label).toEqual(l.path);
          expect(m.type, label).toBe(l.type);
          expect(m.size, label).toEqual(l.size);
          expect(localTime(m.date), label).toBe(l.date);
          expect(m.perms.toCode(), label).toBe(l.perms);
          expect(m.fullPath(), label).toBe(l.fullPath);
        }
        expect(item.isFolder(), label).toBe(expected.isFolder);
        expect(item.isEditable(), label).toBe(expected.isEditable);
        expect(item.isImage(), label).toBe(expected.isImage);
        expect(item.isExtractable(), label).toBe(expected.isExtractable);
        expect(item.isSelectable(), label).toBe(expected.isSelectable);
      });
    });
  });
});
