import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import type { FileManagerConfig } from '../../src/config/types.ts';
import { createFileManager, provideFileManager, useFileManager, type FileManager } from '../../src/services/fileManager.ts';
import type { RawItem } from '../../src/models/Item.ts';
import { dir, file, makeItem, flush, makeConfig, makeI18n, stubFetch, stubXhr, type FakeReply, type RecordedRequest } from './helpers.ts';

const files = [
  file('a.txt'),
  dir('b'),
  file('c.png', { preview: '' }),
  file('d.md'),
  file('e.zip'),
  file('p.jpg', { preview: '/previews/p.jpg' }),
];

let fm: FileManager;
let requests: RecordedRequest[];
let override: ((request: RecordedRequest) => FakeReply | undefined) | undefined;

const defaultReply = (request: RecordedRequest): FakeReply => {
  const body = request.body as { action?: string };
  if (body.action === 'list') return { body: { result: files } };
  if (body.action === 'resolvePermissions') return { body: { auth: { read: [{ role: 'r', selected: true }], update: null, delete: [] } } };
  if (body.action === 'getContent') return { body: { result: 'file text' } };
  return { body: { result: {} } };
};

async function boot(configOverrides: Partial<FileManagerConfig> = {}) {
  window.localStorage.clear();
  override = undefined;
  requests = stubFetch((request) => override?.(request) ?? defaultReply(request));
  fm = createFileManager(makeConfig(configOverrides), makeI18n());
  await fm.init();
  requests.length = 0;
}

/** Lets chained promises and stubbed fetches finish. */
const settle = async () => {
  for (let i = 0; i < 4; i++) await flush();
};
const actionsSent = () => requests.map((r) => (r.body as { action: string }).action);
const item = (name: string) => fm.fileList.find((i) => i.model.name === name)!;
const select = (...names: string[]) => {
  fm.selectOrUnselect(item(names[0]));
  names.slice(1).forEach((name) => fm.selectOrUnselect(item(name), { ctrlKey: true }));
};

beforeEach(boot);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
  delete (window as unknown as Record<string, unknown>).saveAs;
  delete (window as unknown as Record<string, unknown>).myCustomAction;
});

describe('start-up and language', () => {
  it('init() lists the root and leaves the language alone (main.ts resolves it once)', async () => {
    window.localStorage.clear();
    window.history.replaceState(null, '', '/?lang=fr');
    stubFetch((r) => defaultReply(r));
    const i18n = makeI18n();
    const instance = createFileManager(makeConfig(), i18n);
    expect(instance.navigator.fileList).toEqual([]);
    await instance.init();
    expect(instance.navigator.fileList).toHaveLength(files.length);
    expect(i18n.locale.value).toBe('en');
    expect(window.localStorage.getItem('language')).toBeNull();
  });

  it('does nothing before init()', () => {
    stubFetch(() => ({ body: {} }));
    const instance = createFileManager(makeConfig(), makeI18n());
    expect(instance.navigator.requesting).toBe(false);
  });
});

describe('refresh side effects', () => {
  it('a refresh clears selection and search and points the destination at the current path', async () => {
    select('a.txt');
    fm.query = 'x';
    fm.navigator.currentPath = ['b'];
    await fm.refreshLocation();
    await settle();
    expect(fm.temps).toEqual([]);
    expect(fm.query).toBe('');
    expect(fm.selectedModalPath).toEqual(['b']);
  });

  it('refreshLocation(true) sends recycle (F-03)', async () => {
    fm.refreshLocation(true);
    await settle();
    expect(requests[0].body).toEqual({ action: 'list', path: '/', recycle: true });
  });
});

describe('view state', () => {
  it('shows the navigator list filtered by name in every view and sorted only in the table (Q-23)', () => {
    expect(fm.viewTemplate).toBe('main-icons.html');
    expect(fm.fileList.map((i) => i.model.name)).toEqual(files.map((f) => f.name));
    fm.query = 'A.TXT';
    expect(fm.fileList.map((i) => i.model.name)).toEqual(['a.txt']);
    fm.query = '';
    fm.setTemplate('main-table.html');
    expect(fm.fileList.map((i) => i.model.name)).toEqual(['b', 'a.txt', 'c.png', 'd.md', 'e.zip', 'p.jpg']);
    fm.setTemplate('main-icons-preview.html');
    expect(fm.fileList.map((i) => i.model.name)).toEqual(files.map((f) => f.name));
  });

  it('order() toggles the direction on the same column and resets it on a new one', () => {
    fm.setTemplate('main-table.html');
    expect(fm.predicate).toEqual(['model.type', 'model.name']);
    fm.order('model.size');
    expect(fm.predicate[1]).toBe('model.size');
    expect(fm.reverse).toBe(false);
    fm.order('model.size');
    expect(fm.reverse).toBe(true);
    fm.order('model.name');
    expect(fm.reverse).toBe(false);
    fm.order('model.name');
    expect(fm.fileList[0].model.name).toBe('p.jpg');
  });

  it('sorting by the missing model.permissions leaves the original order within the type (Q-06)', () => {
    fm.setTemplate('main-table.html');
    fm.order('model.permissions');
    expect(fm.fileList.map((i) => i.model.name)).toEqual(['b', 'a.txt', 'c.png', 'd.md', 'e.zip', 'p.jpg']);
  });

  it('setTemplate persists the view in localStorage', () => {
    fm.setTemplate('main-table.html');
    expect(window.localStorage.getItem('viewTemplate')).toBe('main-table.html');
  });

  it('starts with the stored view', async () => {
    window.localStorage.setItem('viewTemplate', 'main-table.html');
    stubFetch((r) => defaultReply(r));
    const instance = createFileManager(makeConfig(), makeI18n());
    expect(instance.viewTemplate).toBe('main-table.html');
  });
});

describe('modal()', () => {
  it('opens and closes through the manager and clears error and async state', () => {
    fm.api.error = 'old';
    fm.api.asyncSuccess = true;
    expect(fm.modal('rename')).toBe(true);
    expect(fm.modals.isOpen('rename')).toBe(true);
    expect(fm.api.error).toBe('');
    expect(fm.api.asyncSuccess).toBe(false);
    fm.api.error = 'again';
    fm.modal('rename', true);
    expect(fm.modals.isOpen('rename')).toBe(false);
    expect(fm.api.error).toBe('');
  });

  it('modalWithPathSelector starts the destination at the current path', () => {
    fm.navigator.currentPath = ['x', 'y'];
    fm.modalWithPathSelector('move');
    expect(fm.selectedModalPath).toEqual(['x', 'y']);
    expect(fm.modals.top).toBe('move');
  });

  it('isInThisPath is a substring test on the joined current path (Q-24)', () => {
    fm.navigator.currentPath = ['data', 'x'];
    expect(fm.isInThisPath('data/x')).toBe(true);
    expect(fm.isInThisPath('a')).toBe(true);
    expect(fm.isInThisPath('zzz')).toBe(false);
  });
});

describe('smartClick', () => {
  it('opens a folder', async () => {
    fm.smartClick(item('b'));
    await settle();
    expect(fm.navigator.currentPath).toEqual(['b']);
  });

  it('hands a file to pickCallback first and stops on true', async () => {
    const pickCallback = vi.fn(() => true);
    await boot({ pickCallback, allowedActions: { ...makeConfig().allowedActions, pickFiles: true } });
    select('c.png');
    fm.smartClick(item('c.png'));
    expect(pickCallback).toHaveBeenCalledWith(item('c.png').model);
    expect(fm.modals.stack).toEqual([]);
  });

  it('continues after a pickCallback that does not return true, and ignores it without pickFiles', async () => {
    const pickCallback = vi.fn();
    await boot({ pickCallback, allowedActions: { ...makeConfig().allowedActions, pickFiles: true } });
    select('c.png');
    fm.smartClick(item('c.png'));
    expect(pickCallback).toHaveBeenCalledOnce();
    expect(fm.modals.isOpen('imagepreview')).toBe(true);

    const other = vi.fn(() => true);
    await boot({ pickCallback: other });
    select('c.png');
    fm.smartClick(item('c.png'));
    expect(other).not.toHaveBeenCalled();
    expect(fm.modals.isOpen('imagepreview')).toBe(true);
  });

  it('previews an image in the modal, or downloads it in a new window without previewImagesInModal', async () => {
    select('c.png');
    fm.smartClick(item('c.png'));
    expect(fm.modals.isOpen('imagepreview')).toBe(true);
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    await boot({ previewImagesInModal: false });
    select('c.png');
    fm.smartClick(item('c.png'));
    expect(open).toHaveBeenCalledWith('/api/downloadFile?action=download&path=%2Fc.png', '_blank', '');
    expect(fm.modals.stack).toEqual([]);
  });

  it('opens the editor for an editable file and does nothing for other files', async () => {
    select('d.md');
    fm.smartClick(item('d.md'));
    await settle();
    expect(fm.modals.isOpen('edit')).toBe(true);
    expect(requests[0].body).toEqual({ action: 'getContent', item: '/d.md' });
    expect(item('d.md').tempModel.content).toBe('file text');
    expect(item('d.md').model.content).toBe('file text');
    fm.modal('edit', true);
    requests.length = 0;
    select('e.zip');
    fm.smartClick(item('e.zip'));
    expect(fm.modals.stack).toEqual([]);
    expect(requests).toEqual([]);
  });
});

describe('image preview', () => {
  it('sets the url, marks loading and opens the modal; imageLoaded ends loading', () => {
    select('c.png');
    fm.api.error = 'old';
    fm.openImagePreview();
    expect(fm.modals.top).toBe('imagepreview');
    expect(fm.api.inprocess).toBe(true);
    expect(fm.api.error).toBe('');
    expect(fm.previewUrl).toBe('/api/downloadFile?action=download&path=%2Fc.png');
    fm.imageLoaded();
    expect(fm.api.inprocess).toBe(false);
  });

  it('prefers the model preview', () => {
    select('p.jpg');
    fm.openImagePreview();
    expect(fm.previewUrl).toBe('/previews/p.jpg');
  });

  it('does nothing without a single selection (Q-29)', () => {
    fm.openImagePreview();
    select('c.png', 'p.jpg');
    fm.openImagePreview();
    expect(fm.modals.stack).toEqual([]);
    expect(fm.api.inprocess).toBe(false);
  });
});

describe('edit', () => {
  it('posts the edited content and closes the dialog', async () => {
    select('d.md');
    fm.singleSelection()!.tempModel.content = 'new';
    fm.modal('edit');
    fm.edit();
    await settle();
    expect(requests[0]).toMatchObject({ url: '/api/edit', body: { action: 'edit', item: '/d.md', content: 'new' } });
    expect(fm.modals.isOpen('edit')).toBe(false);
  });

  it('keeps the dialog open on an error', async () => {
    override = () => ({ body: { result: { error: 'read only' } } });
    select('d.md');
    fm.modal('edit');
    fm.edit();
    await settle();
    expect(fm.api.error).toBe('read only');
    expect(fm.modals.isOpen('edit')).toBe(true);
  });

  it('openEditItem and edit do nothing on an empty or multiple selection (Q-29)', async () => {
    fm.openEditItem();
    fm.edit();
    select('d.md', 'a.txt');
    fm.openEditItem();
    fm.edit();
    await settle();
    expect(requests).toEqual([]);
    expect(fm.modals.stack).toEqual([]);
  });
});

describe('permissions', () => {
  it('updatePermissions loads the roles into the model and opens the dialog', async () => {
    select('a.txt');
    fm.updatePermissions();
    await settle();
    expect(requests[0]).toMatchObject({ url: '/api/permissions', body: { action: 'resolvePermissions', path: '/a.txt' } });
    expect(item('a.txt').model.authRead).toEqual([{ role: 'r', selected: true }]);
    expect(item('a.txt').model.authUpdate).toBeNull();
    expect(item('a.txt').model.authDelete).toEqual([]);
    expect(fm.modals.isOpen('changepermissions')).toBe(true);
  });

  it('a failed load opens the dialog anyway and its error is wiped again by opening it', async () => {
    override = () => ({ status: 500, body: {} });
    select('a.txt');
    fm.updatePermissions();
    await settle();
    expect(fm.modals.isOpen('changepermissions')).toBe(true);
    expect(fm.api.error).toBe('');
  });

  it('updatePermissions does nothing without exactly one item (Q-03)', async () => {
    fm.updatePermissions();
    select('a.txt', 'd.md');
    fm.updatePermissions();
    await settle();
    expect(requests).toEqual([]);
    expect(fm.modals.stack).toEqual([]);
  });

  it('changePermissions posts the tempModel and closes the dialog', async () => {
    select('a.txt');
    item('a.txt').tempModel.authRead = [{ role: 'x', selected: false }];
    fm.modal('changepermissions');
    fm.changePermissions();
    await settle();
    expect(requests[0].url).toBe('/api/permissions');
    expect(requests[0].body).toMatchObject({ action: 'changePermissions', path: '/a.txt', item: { name: 'a.txt', authRead: [{ role: 'x', selected: false }] } });
    expect(fm.modals.isOpen('changepermissions')).toBe(false);
  });

  it('changePermissions does nothing for several items (Q-03)', async () => {
    select('a.txt', 'd.md');
    fm.changePermissions();
    await settle();
    expect(requests).toEqual([]);
  });
});

describe('rename', () => {
  it('rejects an empty name and a name that exists in the same folder', async () => {
    select('a.txt');
    item('a.txt').tempModel.name = '';
    expect(fm.rename()).toBe(false);
    expect(fm.api.error).toBe(makeI18n().t('error_invalid_filename'));
    fm.api.error = '';
    item('a.txt').tempModel.name = 'd.md';
    expect(fm.rename()).toBe(false);
    expect(fm.api.error).toBe(makeI18n().t('error_invalid_filename'));
    await settle();
    expect(requests).toEqual([]);
  });

  it('renames, then refreshes and closes', async () => {
    select('a.txt');
    fm.modal('rename');
    item('a.txt').tempModel.name = 'z.txt';
    expect(fm.rename()).toBeUndefined();
    await settle();
    expect(requests[0]).toMatchObject({ url: '/api/rename', body: { action: 'rename', item: '/a.txt', newItemPath: '/z.txt' } });
    expect(actionsSent()).toEqual(['rename', 'list']);
    expect(fm.modals.isOpen('rename')).toBe(false);
  });

  it('keeps the dialog open and does not refresh on an error', async () => {
    override = (r) => ((r.body as { action: string }).action === 'rename' ? { body: { result: { error: 'exists' } } } : undefined);
    select('a.txt');
    fm.modal('rename');
    item('a.txt').tempModel.name = 'z.txt';
    fm.rename();
    await settle();
    expect(actionsSent()).toEqual(['rename']);
    expect(fm.modals.isOpen('rename')).toBe(true);
    expect(fm.api.error).toBe('exists');
  });

  it('does nothing on an empty or multiple selection (Q-29)', async () => {
    expect(fm.rename()).toBeUndefined();
    select('a.txt', 'd.md');
    expect(fm.rename()).toBeUndefined();
    await settle();
    expect(requests).toEqual([]);
  });
});

describe('copy', () => {
  it('validates the new name of a single item against the destination (same folder)', async () => {
    select('a.txt');
    fm.modalWithPathSelector('copy');
    expect(fm.copy()).toBe(false);
    expect(fm.api.error).toBe(makeI18n().t('error_invalid_filename'));
    fm.api.error = '';
    item('a.txt').tempModel.name = '   ';
    expect(fm.copy()).toBe(false);
    await settle();
    expect(requests).toEqual([]);
  });

  it('allows an existing name when the destination is another folder', async () => {
    select('a.txt');
    fm.modalWithPathSelector('copy');
    fm.selectedModalPath = ['other'];
    expect(fm.copy()).toBeUndefined();
    await settle();
    expect(requests[0].body).toEqual({ action: 'copy', items: ['/a.txt'], newPath: '/other', singleFilename: 'a.txt' });
  });

  it('copies several items without name check, refreshes and closes', async () => {
    select('a.txt', 'd.md');
    fm.modalWithPathSelector('copy');
    fm.selectedModalPath = ['t'];
    fm.copy();
    await settle();
    expect(requests[0]).toMatchObject({ url: '/api/copy', body: { action: 'copy', items: ['/a.txt', '/d.md'], newPath: '/t' } });
    expect(actionsSent()).toEqual(['copy', 'list']);
    expect(fm.modals.isOpen('copy')).toBe(false);
  });

  it('stays open on an error', async () => {
    override = (r) => ((r.body as { action: string }).action === 'copy' ? { status: 500, body: {} } : undefined);
    select('a.txt', 'd.md');
    fm.modal('copy');
    fm.copy();
    await settle();
    expect(fm.api.error).toBe(makeI18n().t('error_copying'));
    expect(fm.modals.isOpen('copy')).toBe(true);
    expect(actionsSent()).toEqual(['copy']);
  });
});

describe('compress and extract', () => {
  it('compress needs a name that is non-empty and not an existing name in the destination folder', async () => {
    select('a.txt', 'd.md');
    fm.modalWithPathSelector('compress');
    expect(fm.compress()).toBe(false);
    expect(fm.api.error).toBe(makeI18n().t('error_invalid_filename'));
    fm.temp.tempModel.name = 'a.txt';
    expect(fm.compress()).toBe(false);
    await settle();
    expect(requests).toEqual([]);
  });

  it('compress posts the name and destination, refreshes and closes', async () => {
    select('a.txt', 'd.md');
    fm.modalWithPathSelector('compress');
    fm.temp.tempModel.name = '  pack  ';
    fm.compress();
    await settle();
    expect(requests[0]).toMatchObject({ url: '/api/compress', body: { action: 'compress', items: ['/a.txt', '/d.md'], destination: '/', compressedFilename: 'pack' } });
    expect(actionsSent()).toEqual(['compress', 'list']);
    expect(fm.modals.isOpen('compress')).toBe(false);
  });

  it('compress of one folder uses the folder name as default', async () => {
    select('b');
    fm.modal('compress');
    expect(fm.temp.tempModel.name).toBe('b');
    fm.selectedModalPath = ['elsewhere'];
    fm.compress();
    await settle();
    expect(requests[0].body).toMatchObject({ compressedFilename: 'b', destination: '/elsewhere' });
  });

  it('with compressAsync the dialog stays open and shows the success note; an error resets it', async () => {
    await boot({ compressAsync: true });
    select('a.txt', 'd.md');
    fm.modal('compress');
    fm.temp.tempModel.name = 'pack';
    fm.compress();
    await settle();
    expect(fm.api.asyncSuccess).toBe(true);
    expect(fm.modals.isOpen('compress')).toBe(true);
    expect(actionsSent()).toEqual(['compress', 'list']);

    override = (r) => ((r.body as { action: string }).action === 'compress' ? { body: { result: { error: 'no' } } } : undefined);
    // The refresh after the first run reset the selection.
    select('a.txt', 'd.md');
    fm.temp.tempModel.name = 'pack';
    fm.api.asyncSuccess = true;
    fm.compress();
    await settle();
    expect(fm.api.asyncSuccess).toBe(false);
  });

  it('extract posts the folder name; extractAsync keeps the dialog', async () => {
    select('e.zip');
    fm.modal('extract');
    fm.selectedModalPath = ['out'];
    fm.temp.tempModel.name = 'unpacked';
    fm.extract();
    await settle();
    expect(requests[0]).toMatchObject({ url: '/api/extract', body: { action: 'extract', item: '/e.zip', destination: '/out', folderName: 'unpacked' } });
    expect(fm.modals.isOpen('extract')).toBe(false);

    await boot({ extractAsync: true });
    select('e.zip');
    fm.modal('extract');
    fm.selectedModalPath = ['out'];
    fm.temp.tempModel.name = 'unpacked';
    fm.extract();
    await settle();
    expect(fm.api.asyncSuccess).toBe(true);
    expect(fm.modals.isOpen('extract')).toBe(true);
  });

  it('extract refuses an empty name and, in the same folder, an existing one', async () => {
    select('e.zip');
    fm.temp.tempModel.name = '';
    expect(fm.extract()).toBe(false);
    fm.temp.tempModel.name = 'a.txt';
    expect(fm.extract()).toBe(false);
    await settle();
    expect(requests).toEqual([]);
  });

  it('extract with nothing selected fails the name check instead of throwing (Q-29)', async () => {
    expect(fm.extract()).toBe(false);
    await settle();
    expect(requests).toEqual([]);
  });
});

describe('remove and move', () => {
  it('remove posts every selected item, refreshes and closes', async () => {
    select('a.txt', 'd.md');
    fm.modal('remove');
    fm.remove();
    await settle();
    expect(requests[0]).toMatchObject({ url: '/api/remove', body: { action: 'remove', items: ['/a.txt', '/d.md'] } });
    expect(actionsSent()).toEqual(['remove', 'list']);
    expect(fm.modals.isOpen('remove')).toBe(false);
  });

  it('remove stays open on an error and does not refresh', async () => {
    override = (r) => ((r.body as { action: string }).action === 'remove' ? { body: { result: { error: 'busy' } } } : undefined);
    select('a.txt');
    fm.modal('remove');
    fm.remove();
    await settle();
    expect(fm.api.error).toBe('busy');
    expect(actionsSent()).toEqual(['remove']);
    expect(fm.modals.isOpen('remove')).toBe(true);
  });

  it('move to the folder the items are in is refused', async () => {
    select('a.txt');
    fm.modalWithPathSelector('move');
    expect(fm.move()).toBe(false);
    expect(fm.api.error).toBe('error_cannot_move_same_path');
    await settle();
    expect(requests).toEqual([]);
  });

  it('move posts the destination, refreshes and closes', async () => {
    select('a.txt', 'd.md');
    fm.modalWithPathSelector('move');
    fm.selectedModalPath = ['b'];
    fm.move();
    await settle();
    expect(requests[0]).toMatchObject({ url: '/api/move', body: { action: 'move', items: ['/a.txt', '/d.md'], newPath: '/b' } });
    expect(fm.modals.isOpen('move')).toBe(false);
  });

  it('move with an empty selection just posts (nothing to compare against)', async () => {
    fm.selectedModalPath = ['x'];
    fm.move();
    await settle();
    expect(requests[0].body).toEqual({ action: 'move', items: [], newPath: '/x' });
  });
});

describe('createFolder', () => {
  it('checks the typed name before slugging (Q-28), posts the slug and closes', async () => {
    fm.modal('newfolder');
    const phantom = fm.prepareNewFolder();
    phantom.tempModel.name = 'New Folder';
    fm.createFolder();
    await settle();
    expect(requests[0]).toMatchObject({ url: '/api/createFolder', body: { action: 'createFolder', newPath: '/new-folder' } });
    expect(actionsSent()).toEqual(['createFolder', 'list']);
    expect(fm.modals.isOpen('newfolder')).toBe(false);
  });

  it('an exact existing name is refused, a name that only slugs to an existing one is not (Q-28)', async () => {
    const phantom = fm.prepareNewFolder();
    phantom.tempModel.name = 'b';
    expect(fm.createFolder()).toBe(false);
    expect(fm.api.error).toBe(makeI18n().t('error_invalid_filename'));
    expect(requests).toEqual([]);
    phantom.tempModel.name = 'B ';
    fm.createFolder();
    await settle();
    expect(requests[0].body).toEqual({ action: 'createFolder', newPath: '/b' });
  });

  it('an empty name is refused', () => {
    fm.prepareNewFolder();
    expect(fm.createFolder()).toBe(false);
    expect(requests).toEqual([]);
  });

  it('does nothing when the selection was reset meanwhile (Q-29)', async () => {
    fm.prepareNewFolder();
    fm.selectOrUnselect(null, { target: { hasAttribute: () => true } as unknown as EventTarget });
    expect(fm.createFolder()).toBeUndefined();
    await settle();
    expect(requests).toEqual([]);
  });
});

describe('upload', () => {
  const picked = () => [new File(['1'], 'one.txt'), new File(['2'], 'two.txt')];

  it('addForUpload appends to the waiting list and opens the dialog; removeFromUpload drops one', () => {
    fm.addForUpload([picked()[0]]);
    fm.addForUpload([picked()[1]]);
    expect(fm.uploadFileList.map((f) => f.name)).toEqual(['one.txt', 'two.txt']);
    expect(fm.modals.isOpen('uploadfile')).toBe(true);
    fm.removeFromUpload(0);
    expect(fm.uploadFileList.map((f) => f.name)).toEqual(['two.txt']);
  });

  it('cancelling the dialog keeps the list (Q-11)', () => {
    fm.addForUpload(picked());
    fm.modal('uploadfile', true);
    expect(fm.uploadFileList).toHaveLength(2);
  });

  it('uploads to the current path, then refreshes, clears the list and closes', async () => {
    const Xhr = stubXhr();
    fm.navigator.currentPath = ['b'];
    fm.addForUpload(picked());
    fm.uploadFiles();
    const xhr = Xhr.instances[0];
    expect(xhr.sent!.get('destination')).toBe('/b');
    xhr.respond(200, { result: {} });
    await settle();
    expect(actionsSent()).toEqual(['list']);
    expect(fm.uploadFileList).toEqual([]);
    expect(fm.modals.isOpen('uploadfile')).toBe(false);
  });

  it.each([
    ['result.error', 400, { result: { error: 'too big' } }, 'too big'],
    ['no error text', 500, { foo: 1 }, makeI18n().t('error_uploading_files')],
  ])('shows the failure with %s', async (_label, status, body, message) => {
    const Xhr = stubXhr();
    fm.addForUpload(picked());
    fm.uploadFiles();
    Xhr.instances[0].respond(status, body);
    await settle();
    expect(fm.api.error).toBe(message);
    expect(fm.uploadFileList).toHaveLength(2);
    expect(fm.modals.isOpen('uploadfile')).toBe(true);
  });

  it('survives a network failure with an empty response', async () => {
    const Xhr = stubXhr();
    fm.addForUpload(picked());
    fm.uploadFiles();
    Xhr.instances[0].onerror!();
    await settle();
    expect(fm.api.error).toBe(makeI18n().t('error_uploading_files'));
  });

  it('uploadFiles with an empty list hangs with inprocess true, as the AngularJS frontend', async () => {
    stubXhr();
    fm.uploadFiles();
    await settle();
    expect(fm.api.inprocess).toBe(true);
    expect(fm.modals.stack).toEqual([]);
  });
});

describe('custom actions', () => {
  it('calls a function with the selected item', () => {
    select('a.txt');
    const callback = vi.fn();
    fm.customFileAction('Label', callback);
    fm.customDirAction('Label', callback);
    fm.customAction('Label', callback);
    expect(callback).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenCalledWith(fm.singleSelection());
  });

  it('calls a global function by name', () => {
    select('a.txt');
    const callback = vi.fn();
    (window as unknown as Record<string, unknown>).myCustomAction = callback;
    expect(fm.customAction('Label', 'myCustomAction')).toBeUndefined();
    expect(callback).toHaveBeenCalledWith(fm.singleSelection());
  });

  it('logs an error and returns false for an unknown name', () => {
    const error = vi.spyOn(window.console, 'error').mockImplementation(() => {});
    expect(fm.customAction('Label', 'doesNotExist')).toBe(false);
    expect(error).toHaveBeenCalledWith('custom action [doesNotExist] has to be defined in global window scope!');
  });
});

describe('downloadLink', () => {
  it('fills the link state and opens the dialog', () => {
    select('a.txt');
    fm.downloadLink();
    expect(fm.path).toBe('/a.txt');
    expect(fm.dlLink).toBe(window.location.protocol + '//' + window.location.host + '/api/downloadFile?action=download&path=%2Fa.txt');
    expect(fm.streamLink).toBe('/api/downloadFile?action=stream&path=%2Fa.txt');
    expect(fm.showDefaultUrls).toBe(true);
    expect(fm.showCustomUrls).toBe(false);
    expect(fm.urls).toEqual([]);
    expect(fm.modals.isOpen('downloadlink')).toBe(true);
  });

  it('shows the urls of the API when the item has some', async () => {
    override = (r) => ((r.body as { action: string }).action === 'list' ? { body: { result: [file('u.txt', { urls: { image: '/i', download: '/d' } })] } } : undefined);
    await fm.refreshLocation();
    await settle();
    select('u.txt');
    fm.downloadLink();
    expect(fm.urls).toEqual({ image: '/i', download: '/d' });
    expect(fm.showDefaultUrls).toBe(false);
    expect(fm.showCustomUrls).toBe(true);
  });

  it('does nothing for a folder, several items or no selection', () => {
    select('b');
    fm.downloadLink();
    select('a.txt', 'd.md');
    fm.downloadLink();
    fm.selectOrUnselect(null, { target: { hasAttribute: () => true } as unknown as EventTarget });
    fm.downloadLink();
    expect(fm.modals.stack).toEqual([]);
    expect(fm.path).toBe('');
  });
});

describe('download', () => {
  it('downloads one file through the api', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    select('a.txt');
    expect(fm.download()).toBe(true);
    expect(open).toHaveBeenCalledWith('/api/downloadFile?action=download&path=%2Fa.txt', '_blank', '');
  });

  it('downloads several files as ZIP', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    select('a.txt', 'd.md');
    fm.download();
    expect(open.mock.calls[0][0]).toMatch(/^\/api\/downloadMultiple\?action=downloadMultiple&items%5B%5D=%2Fa\.txt&items%5B%5D=%2Fd\.md&toFilename=/);
  });

  it('settles a failed Ajax download: the error is on api.error, nothing is returned or logged', async () => {
    (window as unknown as Record<string, unknown>).saveAs = vi.fn();
    await boot({ downloadFilesByAjax: true });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    override = (r) => ((r.body as { action?: string } | undefined)?.action === 'list' ? undefined : { status: 500, body: 'x', contentType: 'text/plain' });
    select('a.txt');
    expect(fm.download()).toBeUndefined();
    await settle();
    expect(fm.api.error).toContain('Error 500');
    expect(logged).not.toHaveBeenCalled();
    select('a.txt', 'd.md');
    expect(fm.download()).toBeUndefined();
    await settle();
    expect(logged).not.toHaveBeenCalled();
  });

  it('does nothing when the selection has a folder', () => {
    const open = vi.spyOn(window, 'open');
    select('b', 'a.txt');
    expect(fm.download()).toBeUndefined();
    expect(open).not.toHaveBeenCalled();
  });
});

describe('destination dialog', () => {
  it('has its own navigator, loaded on openNavigator, and opens on top of the move dialog (Q-32)', async () => {
    select('a.txt');
    fm.modalWithPathSelector('move');
    fm.openNavigator(['b']);
    await settle();
    expect(requests[0].body).toEqual({ action: 'list', path: '/b' });
    expect(fm.selector.navigator.currentPath).toEqual(['b']);
    expect(fm.selector.navigator.fileList).toHaveLength(files.length);
    // The main list stays as it is.
    expect(fm.navigator.currentPath).toEqual([]);
    expect(fm.modals.stack).toEqual(['move', 'selector']);
    expect(fm.modals.top).toBe('selector');
  });

  it('the selector has its own error state apart from the main navigator', async () => {
    override = () => ({ body: { result: { error: 'no' } } });
    fm.openNavigator(['x']);
    await settle();
    expect(fm.selector.navigator.error).toBe('no');
    expect(fm.navigator.error).toBe('');
  });

  it('select takes a folder row, stores its segments and closes the selector', async () => {
    select('a.txt');
    fm.modalWithPathSelector('move');
    fm.openNavigator([]);
    await settle();
    fm.select(fm.selector.navigator.fileList[1]);
    expect(fm.selectedModalPath).toEqual(['b']);
    expect(fm.modals.stack).toEqual(['move']);
  });

  it('selectCurrent takes the path shown in the selector', async () => {
    fm.modalWithPathSelector('move');
    fm.openNavigator(['b']);
    await settle();
    fm.selectCurrent();
    expect(fm.selectedModalPath).toEqual(['b']);
    expect(fm.modals.stack).toEqual(['move']);
  });

  it('selectedFilesAreChildOfPath hides folders that are part of the selection', () => {
    select('b');
    expect(fm.selectedFilesAreChildOfPath(item('b'))).toBe(true);
    expect(fm.selectedFilesAreChildOfPath(item('a.txt'))).toBe(false);
  });

  it('getSelectedPath renders the destination, appending the typed name for one file', () => {
    fm.selectedModalPath = [];
    expect(fm.getSelectedPath()).toBe('/');
    select('a.txt');
    item('a.txt').tempModel.name = 'copy.txt';
    expect(fm.getSelectedPath()).toBe('/copy.txt');
    fm.selectedModalPath = ['x', 'y'];
    expect(fm.getSelectedPath()).toBe('/x/y/copy.txt');
    select('b');
    expect(fm.getSelectedPath()).toBe('/x/y');
    select('a.txt', 'd.md');
    expect(fm.getSelectedPath()).toBe('/x/y');
  });

  it('has its own sort state that does not touch the main one', async () => {
    fm.openNavigator([]);
    await settle();
    fm.selector.order('model.size');
    expect(fm.selector.predicate).toEqual(['model.type', 'model.size']);
    expect(fm.predicate).toEqual(['model.type', 'model.name']);
    fm.selector.order('model.size');
    expect(fm.selector.reverse).toBe(true);
    expect(fm.reverse).toBe(false);
    expect(fm.selector.fileList[0].model.type).toBe('file');
  });
});

describe('error state shared with the dialogs', () => {
  it('uses one api instance whose state the dialogs show, apart from the navigators', async () => {
    select('a.txt', 'd.md');
    override = () => ({ body: { result: { error: 'denied' } } });
    fm.remove();
    await settle();
    expect(fm.api.error).toBe('denied');
    expect(fm.navigator.error).toBe('');
  });
});

describe('provide / use', () => {
  it('useFileManager throws when nothing is provided', () => {
    const Child = defineComponent({
      setup() {
        useFileManager();
        return () => h('div');
      },
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => mount(Child)).toThrow(/no file manager provided/);
    warn.mockRestore();
  });

  it('descendants get the provided instance', () => {
    let received: FileManager | undefined;
    const Child = defineComponent({
      setup() {
        received = useFileManager();
        return () => h('span', useFileManager().navigator.currentPath.length);
      },
    });
    const Root = defineComponent({
      setup() {
        provideFileManager(fm);
        return () => h(Child);
      },
    });
    const wrapper = mount(Root);
    expect(received).toBe(fm);
    expect(wrapper.text()).toBe(String(fm.navigator.currentPath.length));
  });

  it('templates re-render with the state', async () => {
    const Child = defineComponent({
      setup() {
        const state = useFileManager();
        return () => h('span', state.temps.length + ':' + state.query);
      },
    });
    const Root = defineComponent({
      setup() {
        provideFileManager(fm);
        return () => h(Child);
      },
    });
    const wrapper = mount(Root);
    expect(wrapper.text()).toBe('0:');
    select('a.txt');
    fm.query = 'q';
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toBe('1:q');
  });
});

describe('destination chosen by row or by the current-folder button', () => {
  const tree: Record<string, RawItem[]> = {
    '/': [file('a.txt'), dir('b'), dir('my docs'), dir('\u00fcn\u00efc\u00f6d\u00e9')],
    '/b': [file('x.txt'), dir('c')],
    '/b/c': [file('y.txt'), dir('d e')],
    '/z': [file('z.txt'), file('z.zip'), dir('zf')],
  };

  beforeEach(async () => {
    override = (request) => {
      const body = request.body as { action?: string; path?: string };
      if (body.action === 'list') return { body: { result: tree[body.path || '/'] ?? [] } };
      return undefined;
    };
    // The items to move live in a folder that is no destination of the cases below.
    fm.navigator.currentPath = ['z'];
    fm.navigator.refresh();
    await settle();
  });

  /** Shows `shown` in the dialog and picks the folder named `name` in it. */
  async function pickRow(shown: string[], name: string) {
    fm.openNavigator(shown);
    await settle();
    fm.select(fm.selector.navigator.fileList.find((i) => i.model.name === name)!);
  }

  async function pickCurrent(shown: string[]) {
    fm.openNavigator(shown);
    await settle();
    fm.selectCurrent();
  }

  // label, folder shown in the dialog, row to pick, segments of the picked folder, request path
  const cases: Array<[string, string[], string | null, string[], string]> = [
    ['root', [], null, [], '/'],
    ['one level', [], 'b', ['b'], '/b'],
    ['several levels', ['b'], 'c', ['b', 'c'], '/b/c'],
    ['a name with spaces', [], 'my docs', ['my docs'], '/my docs'],
    ['a non-ASCII name', [], '\u00fcn\u00efc\u00f6d\u00e9', ['\u00fcn\u00efc\u00f6d\u00e9'], '/\u00fcn\u00efc\u00f6d\u00e9'],
    ['spaces below several levels', ['b', 'c'], 'd e', ['b', 'c', 'd e'], '/b/c/d e'],
  ];

  const moveBody = () => requests.find((r) => (r.body as { action: string }).action === 'move')!.body;

  it.each(cases)('stores the same segments and sends the same path for %s', async (_label, shown, row, segments, path) => {
    // By row (the root has no row) and by the button on the folder itself.
    const ways: Array<() => Promise<void>> = [() => pickCurrent(segments)];
    if (row !== null) ways.unshift(() => pickRow(shown, row));
    for (const way of ways) {
      requests.length = 0;
      select('z.txt');
      await way();
      expect(fm.selectedModalPath).toEqual(segments);
      fm.move();
      await settle();
      expect(moveBody()).toMatchObject({ newPath: path });
    }
  });

  it('sends the same destination for copy, compress and extract', async () => {
    const body = (action: string) => requests.find((r) => (r.body as { action: string }).action === action)!.body;
    select('z.txt');
    fm.modal('copy');
    await pickRow(['b'], 'c');
    fm.copy();
    await settle();
    expect(body('copy')).toMatchObject({ newPath: '/b/c' });

    select('z.txt');
    fm.modal('compress');
    fm.temp.tempModel.name = 'pack';
    await pickRow(['b'], 'c');
    fm.compress();
    await settle();
    expect(body('compress')).toMatchObject({ destination: '/b/c' });

    select('z.zip');
    fm.modal('extract');
    fm.temp.tempModel.name = 'unpacked';
    await pickRow([], 'b');
    fm.extract();
    await settle();
    expect(body('extract')).toMatchObject({ destination: '/b' });
  });

  it('shows the destination of a file selection with its name and of a folder without', async () => {
    await pickRow(['b'], 'c');
    select('z.txt');
    expect(fm.getSelectedPath()).toBe('/b/c/z.txt');
    select('zf');
    expect(fm.getSelectedPath()).toBe('/b/c');
    await pickCurrent([]);
    select('z.txt');
    expect(fm.getSelectedPath()).toBe('/z.txt');
    select('zf');
    expect(fm.getSelectedPath()).toBe('/');
    await pickRow([], 'my docs');
    expect(fm.getSelectedPath()).toBe('/my docs');
  });

  it('stores the root as an empty array when a row has no segments', () => {
    fm.select(makeItem(dir(''), []));
    expect(fm.selectedModalPath).toEqual([]);
    expect(fm.getSelectedPath()).toBe('/');
  });

  describe('move into the folder the item is in is refused', () => {
    const movesSent = () => requests.filter((r) => (r.body as { action: string }).action === 'move');

    // Item in the root: its folder is the root, which a row can only denote through an empty path.
    const inRoot = async () => {
      fm.navigator.currentPath = [];
      fm.navigator.refresh();
      await settle();
      select('a.txt');
    };

    it('for an item in the root, by the current-folder button', async () => {
      await inRoot();
      await pickCurrent([]);
      expect(fm.move()).toBe(false);
      expect(fm.api.error).toBe('error_cannot_move_same_path');
      expect(movesSent()).toEqual([]);
    });

    it('for an item in the root, by a row that denotes the root', async () => {
      await inRoot();
      fm.select(makeItem(dir(''), []));
      expect(fm.move()).toBe(false);
      expect(movesSent()).toEqual([]);
    });

    it('for an item in a nested folder, by the current-folder button', async () => {
      fm.navigator.currentPath = ['b', 'c'];
      fm.navigator.refresh();
      await settle();
      select('y.txt');
      await pickCurrent(['b', 'c']);
      expect(fm.move()).toBe(false);
      expect(movesSent()).toEqual([]);
    });

    it('for an item in a nested folder, by the row of that folder', async () => {
      fm.navigator.currentPath = ['b', 'c'];
      fm.navigator.refresh();
      await settle();
      select('y.txt');
      await pickRow(['b'], 'c');
      expect(fm.move()).toBe(false);
      expect(movesSent()).toEqual([]);
    });

    it('is allowed into another folder', async () => {
      await inRoot();
      await pickRow([], 'b');
      expect(fm.move()).toBeUndefined();
      await settle();
      expect(movesSent()).toHaveLength(1);
    });
  });
});
