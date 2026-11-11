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

  it('keeps the AngularJS tooltip: name and size, binary or decimal prefixes by config', async () => {
    viewUnderTest = name;
    app = await open(name, { files: [file('big.bin', { size: 1536 })] });
    const target = name === 'table' ? app.wrapper.find('td a') : rows()[0];
    expect(target.attributes('title')).toBe('big.bin (1.5 kB)');
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

  describe.each([
    { hideSize: true, hideDate: false, hidePermissions: false },
    { hideSize: false, hideDate: false, hidePermissions: false },
    { hideSize: true, hideDate: true, hidePermissions: false },
    { hideSize: true, hideDate: false, hidePermissions: true },
    { hideSize: true, hideDate: true, hidePermissions: true },
    { hideSize: false, hideDate: true, hidePermissions: true },
  ])('table: columns with %o', (config) => {
    it('shows or hides each column on the header and on the cells of folders and files alike', async () => {
      app = await open('table', { files: [dir('folder'), file('a.txt')], config: { showSizeForDirectories: true, ...config } });
      const expected = [true, !config.hideSize, !config.hideDate, !config.hidePermissions];
      expect(main().findAll('thead th').map((h) => isShown(h.element))).toEqual(expected);
      const items = main().findAll('tr.item-list');
      expect(items).toHaveLength(2);
      for (const item of items) {
        expect(item.findAll('td').map((c) => isShown(c.element))).toEqual(expected);
      }
    });
  });

  it('table: the size cell keeps its responsive class and the folder size switch', async () => {
    app = await open('table', { files: [dir('folder')] });
    const cell = main().find('tr.item-list').findAll('td')[1];
    expect(cell.classes()).toContain('hidden-xs');
    expect(isShown(cell.element)).toBe(true);
    expect(isShown(cell.find('span').element)).toBe(false);
  });

  describe('table: sorting by the permissions column', () => {
    const items = () => [
      file('f1', { rights: 'rwxr-xr-x' }),
      dir('d2', { rights: 'rwxrwxrwx' }),
      file('f2', { rights: 'rw-r--r--' }),
      dir('d1', { rights: 'rwxr-x---' }),
      file('f3', { rights: 'rw-rw-rw-' }),
    ];
    const header = () => main().findAll('thead th')[3];
    const names = () => main().findAll('tr.item-list').map((r) => r.find('td a').text());

    it('orders by the displayed code, folders first, ascending then descending', async () => {
      app = await open('table', { files: items(), config: { hidePermissions: false } });
      await header().find('a').trigger('click');
      expect(names()).toEqual(['d1', 'd2', 'f2', 'f3', 'f1']);
      expect(main().findAll('tr.item-list').map((r) => r.findAll('td')[3].text())).toEqual([
        'drwxr-x---', 'drwxrwxrwx', '-rw-r--r--', '-rw-rw-rw-', '-rwxr-xr-x',
      ]);
      await header().find('a').trigger('click');
      expect(names()).toEqual(['f1', 'f3', 'f2', 'd2', 'd1']);
    });

    it('shows the arrow on the permissions header only, reversed on the second click', async () => {
      app = await open('table', { files: items(), config: { hidePermissions: false } });
      const arrows = () => main().findAll('thead .sortorder').map((a) => isShown(a.element));
      expect(arrows()).toEqual([true, false, false, false]);
      await header().find('a').trigger('click');
      expect(arrows()).toEqual([false, false, false, true]);
      expect(header().find('.sortorder').classes()).not.toContain('reverse');
      await header().find('a').trigger('click');
      expect(header().find('.sortorder').classes()).toContain('reverse');
    });

    it('leaves the other columns sorting on their own fields', async () => {
      app = await open('table', { files: items(), config: { hidePermissions: false } });
      expect(names()).toEqual(['d1', 'd2', 'f1', 'f2', 'f3']);
      // The name column is active at the start, so a click on it reverses.
      await main().findAll('thead th')[0].find('a').trigger('click');
      expect(names()).toEqual(['f3', 'f2', 'f1', 'd2', 'd1']);
      await main().findAll('thead th')[1].find('a').trigger('click');
      expect(names().slice(0, 2).sort()).toEqual(['d1', 'd2']);
    });
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

  describe.each([true, false])('preview: enableThumbnails %s', (enableThumbnails) => {
    const tile = async (raw: ReturnType<typeof file>) => {
      app = await open('preview', { config: { enableThumbnails }, files: [raw] });
      return app.wrapper.find('.col-120.preview');
    };
    const shown = (t: Awaited<ReturnType<typeof tile>>, selector: string) => t.find(selector).exists() && isShown(t.find(selector).element);

    it('image with a thumbnail', async () => {
      const t = await tile(file('p.png', { thumbnail: '/t/p.png' }));
      expect(t.find('.image-preview-thumbnail').exists()).toBe(enableThumbnails);
      expect(t.find('.glyphicon-picture').exists()).toBe(!enableThumbnails);
      expect(shown(t, '.glyphicon-file')).toBe(false);
      expect(shown(t, '.glyphicon-folder-open')).toBe(false);
    });

    it('image with an empty thumbnail gets the picture icon', async () => {
      const t = await tile(file('p.png', { thumbnail: '' }));
      expect(t.find('.image-preview-thumbnail').exists()).toBe(false);
      expect(t.find('.glyphicon-picture').attributes('data-ext')).toBe('png');
      expect(t.find('.glyphicon-picture').classes()).toContain('item-extension');
      expect(shown(t, '.glyphicon-file')).toBe(false);
    });

    it.each(['', '/t/a.txt'])('non-image with thumbnail %j gets the file icon', async (thumbnail) => {
      const t = await tile(file('a.txt', { thumbnail }));
      expect(t.find('.image-preview-thumbnail').exists()).toBe(false);
      expect(t.find('.glyphicon-picture').exists()).toBe(false);
      expect(shown(t, '.glyphicon-file')).toBe(true);
    });

    it('folder gets only the folder icon', async () => {
      const t = await tile(dir('d'));
      expect(shown(t, '.glyphicon-folder-open')).toBe(true);
      expect(t.find('.image-preview-thumbnail').exists()).toBe(false);
      expect(t.find('.glyphicon-picture').exists()).toBe(false);
      expect(shown(t, '.glyphicon-file')).toBe(false);
    });
  });

  it('preview: image without thumbnails gets the picture glyph, other files the file glyph', async () => {
    app = await open('preview', { config: { enableThumbnails: false }, files: [file('a.txt'), file('p.png')] });
    const tiles = app.wrapper.findAll('.col-120.preview');
    expect(tiles[1].find('.glyphicon-picture').attributes('data-ext')).toBe('png');
    expect(isShown(tiles[1].find('.glyphicon-file').element)).toBe(false);
    expect(tiles[0].find('.glyphicon-picture').exists()).toBe(false);
    expect(isShown(tiles[0].find('.glyphicon-file').element)).toBe(true);
    expect(tiles[0].find('.item-name').text()).toBe('a.txt');
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
