import { afterEach, describe, expect, it, vi } from 'vitest';
import { isShown, mountWidget, settle, visibleMenuEntries, type MountOptions, type Mounted } from './helpers.ts';

let app: Mounted;
let stylesheet: HTMLStyleElement | undefined;
afterEach(() => {
  app?.wrapper.unmount();
  stylesheet?.remove();
  stylesheet = undefined;
});

const label = (key: string) => englishLabels[key];
// Labels of the English table, spelled out so a wrong key in a template shows up as a wrong text.
const englishLabels: Record<string, string> = {
  open: 'Open',
  select_this: 'Select this',
  download: 'Download',
  copy_links: 'Copy links',
  download_as_zip: 'Download as ZIP',
  view_item: 'View item',
  rename: 'Rename',
  move: 'Move',
  copy: 'Copy',
  edit: 'Edit',
  permissions: 'Permissions',
  compress: 'Compress',
  extract: 'Extract',
  remove: 'Delete',
  new_folder: 'New folder',
  upload_files: 'Upload files',
};
const labels = (...keys: string[]) => keys.map(label);

const select = (...names: string[]) => {
  const item = (name: string) => app.fm.fileList.find((i) => i.model.name === name)!;
  app.fm.selectOrUnselect(item(names[0]));
  names.slice(1).forEach((name) => app.fm.selectOrUnselect(item(name), { ctrlKey: true }));
};

async function entriesFor(names: string[], options: MountOptions = {}): Promise<string[]> {
  app = await mountWidget(options);
  select(...names);
  await settle();
  return visibleMenuEntries(app.wrapper);
}

describe('context menu entries by selection (default config)', () => {
  const cases: Array<[string, string[], string[]]> = [
    ['one file', ['notes.txt'], ['download', 'copy_links', 'rename', 'move', 'copy', 'edit', 'permissions', 'remove']],
    ['one image', ['photo.png'], ['download', 'copy_links', 'view_item', 'rename', 'move', 'copy', 'permissions', 'remove']],
    ['one archive', ['backup.zip'], ['download', 'copy_links', 'rename', 'move', 'copy', 'permissions', 'extract', 'remove']],
    ['one folder', ['folder'], ['open', 'permissions', 'compress', 'remove']],
    ['several files', ['notes.txt', 'other.txt'], ['download_as_zip', 'move', 'copy', 'compress', 'remove']],
    ['files plus a folder', ['notes.txt', 'folder'], ['compress', 'remove']],
  ];
  for (const [name, selection, expected] of cases) {
    it(name, async () => {
      expect(await entriesFor(selection, { files: undefined })).toEqual(labels(...expected));
    });
  }

  it('shows only new folder and upload without a selection, and not the item list', async () => {
    app = await mountWidget();
    const [itemList, folderList] = app.wrapper.findAll('#context-menu ul');
    expect(isShown(itemList.element)).toBe(false);
    expect(isShown(folderList.element)).toBe(true);
    expect(folderList.findAll('li').filter((li) => isShown(li.element)).map((li) => li.text())).toEqual(labels('new_folder', 'upload_files'));
  });

  it('a Shift-click whose anchor is filtered out selects just the clicked item, without a hole', async () => {
    app = await mountWidget();
    select('other.txt');
    app.fm.query = 'notes';
    await settle();
    app.fm.selectOrUnselect(app.fm.fileList[0], { shiftKey: true });
    expect(app.fm.temps).toEqual([app.fm.fileList[0]]);
  });

  it('survives a selection that is only a hole', async () => {
    app = await mountWidget();
    app.fm.temps = [undefined];
    await settle();
    // `singleSelection()` is empty, so the multi-selection rules apply, with nothing to dereference.
    expect(visibleMenuEntries(app.wrapper)).toEqual(labels('download_as_zip', 'move', 'copy', 'compress', 'remove'));
  });

  it('Q-03: the permissions entry needs exactly one item', async () => {
    expect(await entriesFor(['notes.txt', 'other.txt'])).not.toContain(englishLabels.permissions);
    app.wrapper.unmount();
    expect(await entriesFor(['notes.txt'])).toContain(englishLabels.permissions);
  });
});

describe('context menu entries by config flag', () => {
  it('hides every entry whose action is off', async () => {
    const off = { download: false, downloadLink: false, rename: false, move: false, copy: false, edit: false, changePermissions: false, remove: false };
    expect(await entriesFor(['notes.txt'], { allowedActions: off })).toEqual([]);
  });

  it('hides the divider together with the delete entry', async () => {
    app = await mountWidget({ allowedActions: { remove: false } });
    select('notes.txt');
    await settle();
    const divider = app.wrapper.find('#context-menu li.divider');
    expect(isShown(divider.element)).toBe(false);
  });

  it('shows select this for a file only with pickCallback and pickFiles', async () => {
    const pickCallback = vi.fn();
    expect(await entriesFor(['notes.txt'], { config: { pickCallback }, allowedActions: { pickFiles: true } })).toContain('Select this');
    app.wrapper.unmount();
    expect(await entriesFor(['notes.txt'], { config: { pickCallback }, allowedActions: { pickFiles: false } })).not.toContain('Select this');
    app.wrapper.unmount();
    expect(await entriesFor(['notes.txt'], { allowedActions: { pickFiles: true } })).not.toContain('Select this');
  });

  it('shows select this for a folder only with pickFolders', async () => {
    const pickCallback = vi.fn();
    expect(await entriesFor(['folder'], { config: { pickCallback }, allowedActions: { pickFolders: true } })).toContain('Select this');
    app.wrapper.unmount();
    expect(await entriesFor(['folder'], { config: { pickCallback }, allowedActions: { pickFiles: true } })).not.toContain('Select this');
  });

  it('calls pickCallback with the model of the selected item', async () => {
    const pickCallback = vi.fn();
    await entriesFor(['notes.txt'], { config: { pickCallback }, allowedActions: { pickFiles: true } });
    const entry = app.wrapper.findAll('#context-menu li a').find((a) => a.text() === 'Select this')!;
    await entry.trigger('click');
    expect(pickCallback).toHaveBeenCalledWith(app.fm.temps[0]!.model);
  });

  it('lists custom file actions for one file and custom folder actions for one folder', async () => {
    const options = { allowedActions: { customFileActions: { 'File thing': () => {} }, customDirActions: { 'Folder thing': () => {} } } };
    expect(await entriesFor(['notes.txt'], options)).toContain('File thing');
    expect(await entriesFor(['notes.txt'], options)).not.toContain('Folder thing');
    app.wrapper.unmount();
    const folder = await entriesFor(['folder'], options);
    expect(folder).toContain('Folder thing');
    expect(folder).not.toContain('File thing');
    app.wrapper.unmount();
    expect(await entriesFor(['notes.txt', 'other.txt'], options)).not.toContain('File thing');
  });

  it('passes the label and callback to the custom action handler', async () => {
    const callback = vi.fn();
    await entriesFor(['notes.txt'], { allowedActions: { customFileActions: { 'File thing': callback } } });
    await app.wrapper.findAll('#context-menu li a').find((a) => a.text() === 'File thing')!.trigger('click');
    expect(callback).toHaveBeenCalledWith(app.fm.temps[0]);
  });

  it('shows the edit entry for an editable file only', async () => {
    const pattern = { isEditableFilePattern: /\.txt$/i };
    expect(await entriesFor(['notes.txt'], { config: pattern })).toContain('Edit');
    app.wrapper.unmount();
    expect(await entriesFor(['photo.png'], { config: pattern })).not.toContain('Edit');
  });
});

describe('context menu actions', () => {
  it('sends each entry to the state', async () => {
    app = await mountWidget();
    const modal = vi.spyOn(app.fm, 'modal');
    const selector = vi.spyOn(app.fm, 'modalWithPathSelector');
    select('notes.txt');
    await settle();
    const click = async (text: string) => app.wrapper.findAll('#context-menu li a').find((a) => a.text() === text)!.trigger('click');
    await click('Rename');
    expect(modal).toHaveBeenCalledWith('rename');
    await click('Move');
    expect(selector).toHaveBeenCalledWith('move');
    await click('Copy');
    expect(selector).toHaveBeenCalledWith('copy');
    await click('Delete');
    expect(modal).toHaveBeenCalledWith('remove');
  });

  it('opens a folder with the double-click dispatcher', async () => {
    app = await mountWidget();
    const smartClick = vi.spyOn(app.fm, 'smartClick');
    select('folder');
    await settle();
    await app.wrapper.findAll('#context-menu li a').find((a) => a.text() === 'Open')!.trigger('click');
    expect(smartClick).toHaveBeenCalledWith(app.fm.temps[0]);
  });

  it('opens new folder from the empty menu', async () => {
    app = await mountWidget();
    await app.wrapper.findAll('#context-menu ul')[1].find('a').trigger('click');
    expect(app.fm.modals.isOpen('newfolder')).toBe(true);
    expect(app.fm.newFolder).not.toBeNull();
    expect(app.fm.temps).toHaveLength(0);
  });

  it('after a cancelled new folder dialog the menu offers the empty-space entries without a selection', async () => {
    app = await mountWidget();
    app.fm.prepareNewFolder();
    app.fm.modals.open('newfolder');
    app.fm.modals.close('newfolder');
    await settle();
    const [itemList, folderList] = app.wrapper.findAll('#context-menu ul');
    expect(isShown(itemList.element)).toBe(false);
    expect(folderList.findAll('li').filter((li) => isShown(li.element)).map((li) => li.text())).toEqual(labels('new_folder', 'upload_files'));
  });

  it('after a cancelled new folder dialog the menu still offers the entries of the previous selection', async () => {
    app = await mountWidget();
    select('notes.txt');
    app.fm.prepareNewFolder();
    app.fm.modals.open('newfolder');
    app.fm.modals.close('newfolder');
    await settle();
    expect(visibleMenuEntries(app.wrapper)).toEqual(
      labels('download', 'copy_links', 'rename', 'move', 'copy', 'edit', 'permissions', 'remove'),
    );
  });

  it('prevents the default action of the anchors', async () => {
    app = await mountWidget();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    app.wrapper.findAll('#context-menu ul')[1].find('a').element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('context menu position and visibility', () => {
  /** jsdom has no layout: give the menu a width and the widget root an offset. */
  function layout(menuWidth: number, offset = { left: 10, top: 20 }) {
    // The widget stylesheet hides the menu until jQuery-style show() runs.
    stylesheet = document.createElement('style');
    stylesheet.textContent = '#context-menu { display: none; }';
    document.head.appendChild(stylesheet);
    const menu = app.wrapper.find('#context-menu').element as HTMLElement;
    vi.spyOn(menu, 'getBoundingClientRect').mockReturnValue({ width: menuWidth } as DOMRect);
    const rootDiv = menu.parentElement!.parentElement!;
    vi.spyOn(rootDiv, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    vi.spyOn(rootDiv, 'getBoundingClientRect').mockReturnValue({ left: offset.left, top: offset.top } as DOMRect);
    return menu;
  }
  const rightClick = (target: Element, pageX: number, pageY: number) => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: pageX, clientY: pageY });
    // jsdom has no page coordinates.
    Object.defineProperty(event, 'pageX', { value: pageX });
    Object.defineProperty(event, 'pageY', { value: pageY });
    target.dispatchEvent(event);
    return event;
  };

  it('is hidden before any click and shows at the click position relative to the root', async () => {
    app = await mountWidget({ view: 'main-table.html' });
    const menu = layout(160);
    expect(menu.style.display).toBe('');
    const event = rightClick(app.wrapper.find('tr.item-list').element, 300, 200);
    expect(event.defaultPrevented).toBe(true);
    await settle();
    expect(menu.style.display).toBe('block');
    expect(menu.style.position).toBe('absolute');
    expect(menu.style.left).toBe('290px');
    expect(menu.style.top).toBe('180px');
  });

  it('flips to the left near the right window edge', async () => {
    app = await mountWidget({ view: 'main-table.html' });
    const menu = layout(160);
    // 1000 - 10 = 990, and 990 >= innerWidth (1024) - 160.
    rightClick(app.wrapper.find('tr.item-list').element, 1000, 50);
    await settle();
    expect(menu.style.left).toBe('830px');
  });

  it('opens for the free area of the icon view and for a tile', async () => {
    app = await mountWidget();
    const menu = layout(160);
    rightClick(app.wrapper.find('.item-list.clearfix').element, 100, 100);
    await settle();
    expect(menu.style.display).toBe('block');
    menu.style.display = 'none';
    rightClick(app.wrapper.find('a.thumbnail').element, 100, 100);
    await settle();
    expect(menu.style.display).toBe('block');
  });

  it('does not open, and leaves the default action, outside the item list', async () => {
    app = await mountWidget();
    const menu = layout(160);
    const event = rightClick(app.wrapper.find('nav').element, 100, 100);
    await settle();
    expect(event.defaultPrevented).toBe(false);
    expect(menu.style.display).toBe('');
  });

  it('does not open on the header row of the table', async () => {
    app = await mountWidget({ view: 'main-table.html' });
    const menu = layout(160);
    rightClick(app.wrapper.find('thead th').element, 100, 100);
    await settle();
    expect(menu.style.display).toBe('');
  });

  it('hides on any click in the document', async () => {
    app = await mountWidget();
    const menu = layout(160);
    rightClick(app.wrapper.find('.item-list.clearfix').element, 100, 100);
    await settle();
    document.body.click();
    expect(menu.style.display).toBe('none');
  });

  it('selects the right-clicked item before the menu content is measured', async () => {
    app = await mountWidget({ view: 'main-table.html' });
    layout(160);
    const row = app.wrapper.findAll('tr.item-list')[1];
    row.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
    await settle();
    expect(app.fm.temps).toHaveLength(1);
  });
});
