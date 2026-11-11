import { afterEach, describe, expect, it, vi } from 'vitest';
import { dir, file, isShown, mountWidget, settle, type MountOptions, type Mounted } from './helpers.ts';

let app: Mounted;
afterEach(() => app?.wrapper.unmount());

/** The main screen; the mounted destination dialog renders its own tables, spinner and messages outside it. */
const main = () => app.wrapper.find('.main-navigation');

const VIEWS = {
  icons: { view: 'main-icons.html', row: 'a.thumbnail' },
  table: { view: 'main-table.html', row: 'tr.item-list' },
  preview: { view: 'main-icons-preview.html', row: 'a.thumbnail' },
} as const;
type ViewName = keyof typeof VIEWS;

const open = (name: ViewName, options: MountOptions = {}) =>
  mountWidget({ ...options, view: VIEWS[name].view, config: { enableIconPreviewView: true, ...options.config } });

const rows = () => app.wrapper.findAll(VIEWS[viewUnderTest].row);
let viewUnderTest: ViewName = 'icons';

describe.each(Object.keys(VIEWS) as ViewName[])('%s view gestures', (name) => {
  const itemAt = (index: number) => app.fm.fileList[index];

  it('selects a clicked item and passes the native event', async () => {
    viewUnderTest = name;
    app = await open(name);
    const spy = vi.spyOn(app.fm, 'selectOrUnselect');
    await rows()[1].trigger('click');
    expect(spy).toHaveBeenCalledTimes(name === 'table' ? 1 : 2);
    expect(spy.mock.calls[0][0]).toBe(itemAt(1));
    expect(spy.mock.calls[0][1]).toBeInstanceOf(MouseEvent);
    expect(app.fm.temps).toEqual([itemAt(1)]);
    expect(rows()[1].classes()).toContain('selected');
  });

  it('adds with ctrl-click and with meta-click', async () => {
    viewUnderTest = name;
    app = await open(name);
    await rows()[0].trigger('click');
    await rows()[1].trigger('click', { ctrlKey: true });
    await rows()[2].trigger('click', { metaKey: true });
    expect(app.fm.temps).toHaveLength(3);
  });

  it('selects a range with shift-click on the displayed list', async () => {
    viewUnderTest = name;
    app = await open(name);
    await rows()[0].trigger('click');
    await rows()[2].trigger('click', { shiftKey: true });
    expect(app.fm.temps).toEqual([itemAt(0), itemAt(1), itemAt(2)]);
  });

  it('right-click selects an unselected item, prevents the default and keeps a selection it hits', async () => {
    viewUnderTest = name;
    app = await open(name);
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    Object.defineProperty(event, 'which', { value: 3 });
    rows()[1].element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(app.fm.temps).toEqual([itemAt(1)]);

    await rows()[2].trigger('click', { ctrlKey: true });
    const again = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    Object.defineProperty(again, 'which', { value: 3 });
    rows()[1].element.dispatchEvent(again);
    expect(app.fm.temps).toHaveLength(2);
  });

  it('opens the item with a double-click', async () => {
    viewUnderTest = name;
    app = await open(name);
    const spy = vi.spyOn(app.fm, 'smartClick');
    await rows()[2].trigger('dblclick');
    expect(spy).toHaveBeenCalledWith(itemAt(2));
  });

  it('keeps the legacy tooltip: name and size, binary or decimal prefixes by config', async () => {
    viewUnderTest = name;
    app = await open(name, { files: [file('big.bin', { size: 1536 })] });
    const target = name === 'table' ? app.wrapper.find('td a') : rows()[0];
    expect(target.attributes('title')).toBe('big.bin (1.5  kB)');
  });

  it('renders a selection hole without failing', async () => {
    viewUnderTest = name;
    app = await open(name);
    app.fm.temps = [undefined, itemAt(0)];
    await settle();
    expect(rows()[0].classes()).toContain('selected');
    expect(rows()[1].classes()).not.toContain('selected');
  });

  it('shows the folder name list state: not requesting, no error, a list', async () => {
    viewUnderTest = name;
    app = await open(name);
    expect(rows()).toHaveLength(5);
    expect(rows().every((row) => isShown(row.element))).toBe(true);
  });
});

describe('icon views: free area (F-23)', () => {
  for (const name of ['icons', 'preview'] as const) {
    it(`${name}: a click or right-click on the free area clears the selection`, async () => {
      app = await open(name);
      const tile = app.wrapper.find('a.thumbnail');
      await tile.trigger('click');
      expect(app.fm.temps).toHaveLength(1);
      await app.wrapper.find('.item-list.clearfix').trigger('click');
      expect(app.fm.temps).toHaveLength(0);

      await tile.trigger('click');
      await app.wrapper.find('.item-list.clearfix').trigger('contextmenu');
      expect(app.fm.temps).toHaveLength(0);
    });

    it(`${name}: a click on a tile does not clear the selection through the container`, async () => {
      app = await open(name);
      await app.wrapper.find('a.thumbnail').trigger('click');
      expect(app.fm.temps).toHaveLength(1);
    });

    it(`${name}: the container carries the prevent attribute`, async () => {
      app = await open(name);
      expect(app.wrapper.find('.item-list.clearfix').attributes('prevent')).toBe('true');
    });
  }

  it('the table has no free-area behaviour', async () => {
    app = await open('table');
    await app.wrapper.find('tr.item-list').trigger('click');
    await app.wrapper.find('table').trigger('click');
    expect(app.fm.temps).toHaveLength(1);
  });
});

describe('icon content', () => {
  it('icons: shows the folder or file glyph and the extension for files', async () => {
    app = await open('icons', { files: [dir('folder'), file('archive.tar.gz'), file('README')] });
    const tiles = app.wrapper.findAll('.col-120');
    expect(isShown(tiles[0].find('.glyphicon-folder-open').element)).toBe(true);
    expect(isShown(tiles[0].find('.glyphicon-file').element)).toBe(false);
    const archive = tiles[1].find('.glyphicon-file');
    expect(archive.attributes('data-ext')).toBe('gz');
    expect(archive.classes()).toContain('item-extension');
    expect(tiles[2].find('.glyphicon-file').attributes('data-ext')).toBe('');
  });

  it('icons: leaves the extension marker off without showExtensionIcons', async () => {
    app = await open('icons', { config: { showExtensionIcons: false } });
    expect(app.wrapper.find('.glyphicon-file').classes()).not.toContain('item-extension');
  });

  it('icons: truncates names to 11 characters with ...', async () => {
    app = await open('icons', { files: [file('abcdefghijklmnop.txt')] });
    expect(app.wrapper.find('a.thumbnail').text()).toBe('abcdefghijk...');
  });

  it('table: truncates names to 64 characters', async () => {
    app = await open('table', { files: [file('x'.repeat(70))] });
    expect(app.wrapper.find('td a').text()).toBe('x'.repeat(64) + '...');
  });

  it('table: hides directory sizes unless showSizeForDirectories', async () => {
    app = await open('table', { files: [dir('folder')] });
    expect(isShown(app.wrapper.find('tr.item-list td.hidden-xs span').element)).toBe(false);
    app.wrapper.unmount();
    app = await open('table', { files: [dir('folder')], config: { showSizeForDirectories: true } });
    expect(isShown(app.wrapper.find('tr.item-list td.hidden-xs span').element)).toBe(true);
  });

  it('table: shows the permission code and the formatted date', async () => {
    app = await open('table', { files: [file('a.txt', { rights: 'rwxr-xr-x' }), dir('d', { rights: 'rwxr-xr-x' })], config: { hidePermissions: false } });
    const cells = main().findAll('tr.item-list');
    // Folders sort first.
    expect(cells[0].findAll('td')[3].text()).toBe('drwxr-xr-x');
    expect(cells[1].findAll('td')[3].text()).toBe('-rwxr-xr-x');
    expect(cells[1].findAll('td')[2].text()).toMatch(/^2021-03-0\d \d\d:\d\d:\d\d$/);
  });

  it('table: Q-07 hideSize hides the header cell only', async () => {
    app = await open('table', { config: { hideSize: true } });
    const headers = main().findAll('thead th');
    expect(isShown(headers[1].element)).toBe(false);
    expect(isShown(main().find('tbody tr.item-list td.hidden-xs').element)).toBe(true);
  });

  it('table: hides date and permission columns by config on header and cells', async () => {
    app = await open('table', { config: { hideDate: true, hidePermissions: true } });
    const headers = main().findAll('thead th');
    expect(headers.map((h) => isShown(h.element))).toEqual([true, true, false, false]);
    const cells = main().findAll('tr.item-list')[0].findAll('td');
    expect(cells.map((c) => isShown(c.element))).toEqual([true, true, false, false]);
  });

  it('preview: image with thumbnails shows the lazy thumbnail image', async () => {
    app = await open('preview', { config: { enableThumbnails: true }, files: [file('p.png', { thumbnail: '/t/p.png' })] });
    const img = app.wrapper.find('.image-preview-thumbnail img');
    expect(img.attributes()).toMatchObject({ src: '/t/p.png', alt: 'p.png', loading: 'lazy' });
    expect(app.wrapper.find('.iconset .glyphicon-picture').exists()).toBe(false);
  });

  it('preview: Q-08 image with thumbnails on and no thumbnail gets no icon at all', async () => {
    app = await open('preview', { config: { enableThumbnails: true }, files: [file('p.png', { thumbnail: '' })] });
    expect(app.wrapper.find('.image-preview-thumbnail').exists()).toBe(false);
    expect(app.wrapper.find('.iconset .glyphicon-picture').exists()).toBe(false);
    expect(isShown(app.wrapper.find('.iconset .glyphicon-file').element)).toBe(false);
  });

  it('preview: image without thumbnails gets the picture glyph, other files the file glyph', async () => {
    app = await open('preview', { config: { enableThumbnails: false }, files: [file('p.png'), file('a.txt')] });
    const tiles = app.wrapper.findAll('.col-120.preview');
    expect(tiles[0].find('.glyphicon-picture').attributes('data-ext')).toBe('png');
    expect(isShown(tiles[0].find('.glyphicon-file').element)).toBe(false);
    expect(tiles[1].find('.glyphicon-picture').exists()).toBe(false);
    expect(isShown(tiles[1].find('.glyphicon-file').element)).toBe(true);
    expect(tiles[1].find('.item-name').text()).toBe('a.txt');
  });
});

describe.each(Object.keys(VIEWS) as ViewName[])('%s view states', (name) => {
  /** Texts of the state elements that are currently visible. */
  const visibleStates = (): string[] => {
    const selector = name === 'table' ? 'tbody tr:not(.item-list)' : '.alert, .iconset > div:not(.item-list)';
    return main()
      .findAll(selector)
      .filter((el) => isShown(el.element))
      .map((el) => el.text() || 'spinner');
  };

  it('shows the empty message with the literal dots', async () => {
    app = await open(name, { files: [] });
    expect(visibleStates()).toEqual(['No files in this folder...']);
  });

  it('shows the list error instead of the empty message', async () => {
    app = await open(name, { reply: () => ({ status: 500, body: { result: { error: 'Disk on fire' } } }) });
    expect(visibleStates()).toEqual(['Disk on fire']);
    expect(main().findAll(VIEWS[name].row).length).toBe(0);
  });

  it('shows the spinner while loading and hides the list', async () => {
    app = await open(name);
    app.fm.navigator.requesting = true;
    await settle();
    expect(visibleStates()).toEqual(['spinner']);
    expect(main().find('.spinner-wrapper.col-xs-12 svg.spinner-container').exists()).toBe(true);
    if (name === 'table') {
      expect(main().findAll('tr.item-list').every((row) => !isShown(row.element))).toBe(true);
    } else {
      expect(main().findAll('.col-120').length).toBeGreaterThan(0);
    }
  });

  it('shows nothing but the list for a normal folder', async () => {
    app = await open(name);
    expect(visibleStates()).toEqual([]);
  });
});

describe('table sorting', () => {
  it('sorts folders first, then by column, and flips everything on the second click', async () => {
    app = await open('table', { files: [file('b.txt', { size: 5 }), dir('z', { size: 3 }), file('a.txt', { size: 9 }), dir('y', { size: 1 })] });
    const names = () => main().findAll('tr.item-list').map((row) => row.find('a').text());
    expect(names()).toEqual(['y', 'z', 'a.txt', 'b.txt']);
    await main().findAll('thead th a')[0].trigger('click');
    expect(names()).toEqual(['b.txt', 'a.txt', 'z', 'y']);
    await main().findAll('thead th a')[1].trigger('click');
    expect(names()).toEqual(['y', 'z', 'b.txt', 'a.txt']);
  });

  it('shows the arrow on the active column only and marks the reversed direction', async () => {
    app = await open('table');
    const arrows = () => main().findAll('thead .sortorder').map((span) => [isShown(span.element), span.classes('reverse')]);
    expect(arrows()).toEqual([[true, false], [false, false], [false, false], [false, false]]);
    await main().findAll('thead th a')[0].trigger('click');
    expect(arrows()[0]).toEqual([true, true]);
    await main().findAll('thead th a')[1].trigger('click');
    expect(arrows()).toEqual([[false, false], [true, false], [false, false], [false, false]]);
  });

  it('does not reload the page: header anchors prevent the default action', async () => {
    app = await open('table');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    main().find('thead th a').element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
