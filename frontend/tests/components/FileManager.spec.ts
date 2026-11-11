import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountWidget, settle, type Mounted } from './helpers.ts';

let app: Mounted;
afterEach(() => {
  app?.wrapper.unmount();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0';
const userAgent = (value: string) => vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(value);

/** A drag event as the browser dispatches it; jsdom has no DataTransfer, so the part the zone reads is stubbed. */
function dragEvent(type: string, types: string[] = ['Files'], extra: Record<string, unknown> = {}): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { types, effectAllowed: 'all', dropEffect: 'none', ...extra } });
  return event;
}

const root = () => app.wrapper.element as HTMLElement;

describe('FileManager layout', () => {
  it('renders the four legacy blocks in order below the root div', async () => {
    app = await mountWidget();
    const blocks = Array.from(root().children);
    expect(blocks).toHaveLength(4);
    expect(blocks[0].querySelector('nav.navbar')).not.toBeNull();
    expect(blocks[1].className).toBe('container-fluid');
    expect(blocks[3].querySelector('#context-menu')).not.toBeNull();
  });

  it('gives the sidebar column and the main column their classes once the tree has a root', async () => {
    app = await mountWidget();
    const sidebar = root().querySelector('.sidebar') as HTMLElement;
    expect(sidebar.className).toBe('col-sm-4 col-md-3 sidebar file-tree animated slow fadeIn');
    expect(sidebar.style.display).not.toBe('none');
    expect(root().querySelector('.main')!.className).toBe('main col-sm-8 col-md-9');
  });

  it('hides the sidebar and drops the main column classes without the sidebar option', async () => {
    app = await mountWidget({ config: { sidebar: false } });
    expect((root().querySelector('.sidebar') as HTMLElement).style.display).toBe('none');
    expect(root().querySelector('.main')!.className).toBe('main');
  });

  it('keeps the sidebar hidden until the first listing has built the tree', async () => {
    app = await mountWidget();
    app.fm.navigator.history = [];
    await settle();
    expect((root().querySelector('.sidebar') as HTMLElement).style.display).toBe('none');
    expect(root().querySelector('.main')!.className).toBe('main');
  });

  it('renders the active view inside .main-navigation and swaps it on setTemplate', async () => {
    app = await mountWidget();
    expect(root().querySelector('.main-navigation .iconset')).not.toBeNull();
    app.fm.setTemplate('main-table.html');
    await settle();
    expect(root().querySelector('.main-navigation table.table-files')).not.toBeNull();
    expect(root().querySelector('.main-navigation .iconset')).toBeNull();
  });

  it('marks the place where the dialogs are mounted', async () => {
    app = await mountWidget();
    expect(root().children[2].tagName).toBe('DIV');
  });
});

describe('FileManager drop zone (F-70)', () => {
  it('sets upload-dragover while files are dragged over and keeps it across a quick leave and re-enter', async () => {
    app = await mountWidget();
    vi.useFakeTimers();
    expect(root().classList.contains('upload-dragover')).toBe(false);

    root().dispatchEvent(dragEvent('dragover'));
    await app.wrapper.vm.$nextTick();
    expect(root().classList.contains('upload-dragover')).toBe(true);

    // ng-file-upload removes the class 1 ms after dragleave unless another dragover follows.
    root().dispatchEvent(dragEvent('dragleave'));
    root().dispatchEvent(dragEvent('dragover'));
    vi.advanceTimersByTime(10);
    await app.wrapper.vm.$nextTick();
    expect(root().classList.contains('upload-dragover')).toBe(true);

    root().dispatchEvent(dragEvent('dragleave'));
    vi.advanceTimersByTime(10);
    await app.wrapper.vm.$nextTick();
    expect(root().classList.contains('upload-dragover')).toBe(false);
  });

  it('reacts to every drag, whatever it carries (ngf-drop has no type check)', async () => {
    app = await mountWidget();
    const event = dragEvent('dragover', ['text/plain']);
    root().dispatchEvent(event);
    await app.wrapper.vm.$nextTick();
    expect(root().classList.contains('upload-dragover')).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    const enter = dragEvent('dragenter', []);
    root().dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
  });

  it('copies by default and moves for move and linkMove, in Chrome only', async () => {
    app = await mountWidget();
    const effectFor = (effectAllowed: string): string => {
      const event = dragEvent('dragover', ['Files'], { effectAllowed });
      root().dispatchEvent(event);
      return (event as unknown as { dataTransfer: { dropEffect: string } }).dataTransfer.dropEffect;
    };
    userAgent(CHROME);
    expect(effectFor('all')).toBe('copy');
    expect(effectFor('copy')).toBe('copy');
    expect(effectFor('move')).toBe('move');
    expect(effectFor('linkMove')).toBe('move');
    // The directive tests the user agent for "Chrome"; elsewhere the browser's own effect stays.
    userAgent(FIREFOX);
    expect(effectFor('move')).toBe('none');
    expect(effectFor('all')).toBe('none');
  });

  it('removes the class at once on drop and hands the files to addForUpload', async () => {
    app = await mountWidget();
    const spy = vi.spyOn(app.fm, 'addForUpload').mockImplementation(() => {});
    const dropped = new File(['x'], 'a.txt', { type: 'text/plain' });
    root().dispatchEvent(dragEvent('dragover'));
    await app.wrapper.vm.$nextTick();
    const drop = dragEvent('drop', ['Files'], { files: [dropped] });
    root().dispatchEvent(drop);
    await app.wrapper.vm.$nextTick();
    expect(drop.defaultPrevented).toBe(true);
    expect(root().classList.contains('upload-dragover')).toBe(false);
    await settle();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual([dropped]);
  });

  describe('without files', () => {
    const dropWithHtml = async (getData: unknown, ...more: Array<Promise<unknown>>) => {
      app = await mountWidget();
      const spy = vi.spyOn(app.fm, 'addForUpload').mockImplementation(() => {});
      root().dispatchEvent(dragEvent('drop', ['text/html'], { files: [], getData }));
      await settle();
      await Promise.all(more);
      await settle();
      return spy;
    };
    const html = (markup: string) => (type: string) => (type === 'text/html' ? markup : '');

    it('does nothing for a drop that carries neither files nor images (Q-49)', async () => {
      const spy = await dropWithHtml(html(''));
      expect(spy).not.toHaveBeenCalled();
      expect(app.fm.modals.isOpen('uploadfile')).toBe(false);
      expect(app.fm.uploadFileList).toEqual([]);
    });

    it('does nothing when the transfer offers no readable HTML', async () => {
      const missing = await dropWithHtml(undefined);
      expect(missing).not.toHaveBeenCalled();
      const throwing = await dropWithHtml(() => {
        throw new Error('denied');
      });
      expect(throwing).not.toHaveBeenCalled();
    });

    it('fetches the images named in dropped HTML and hands them over as named blobs', async () => {
      app = await mountWidget({ reply: (request) => (request.url.startsWith('http://img.test/') ? { body: 'PNGDATA', contentType: 'image/png' } : undefined) });
      const spy = vi.spyOn(app.fm, 'addForUpload').mockImplementation(() => {});
      const markup = '<p><IMG src="http://img.test/a/one.png?x=1"> <img alt="" class="c" src="http://img.test/two.png"></p>';
      root().dispatchEvent(dragEvent('drop', ['text/html'], { files: [], getData: html(markup) }));
      await settle();
      expect(spy).toHaveBeenCalledTimes(1);
      const blobs = spy.mock.calls[0][0] as unknown as Array<Blob & { name: string }>;
      expect(blobs.map((blob) => blob.name).sort()).toEqual(['one.png', 'two.png']);
      expect(blobs.every((blob) => blob.type === 'image/png')).toBe(true);
    });

    it('delivers nothing when one of the images cannot be fetched', async () => {
      app = await mountWidget({ reply: (request) => (request.url.endsWith('bad.png') ? { status: 404, body: '' } : undefined) });
      const spy = vi.spyOn(app.fm, 'addForUpload').mockImplementation(() => {});
      const markup = '<img src="http://img.test/ok.png"><img src="http://img.test/bad.png">';
      root().dispatchEvent(dragEvent('drop', ['text/html'], { files: [], getData: html(markup) }));
      await settle();
      expect(spy).not.toHaveBeenCalled();
    });

    it('leaves a paste of plain text alone: no dialog, and the paste is not prevented (Q-49)', async () => {
      app = await mountWidget();
      const spy = vi.spyOn(app.fm, 'addForUpload').mockImplementation(() => {});
      const paste = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(paste, 'clipboardData', { value: { items: [], files: [], getData: html('') } });
      root().querySelector('input')!.dispatchEvent(paste);
      await settle();
      expect(spy).not.toHaveBeenCalled();
      expect(app.fm.modals.isOpen('uploadfile')).toBe(false);
      expect(paste.defaultPrevented).toBe(false);
    });

    it('still delivers pasted files', async () => {
      app = await mountWidget();
      const spy = vi.spyOn(app.fm, 'addForUpload').mockImplementation(() => {});
      const pasted = new File(['x'], 'p.png', { type: 'image/png' });
      const paste = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(paste, 'clipboardData', { value: { files: [pasted], getData: html('') } });
      root().querySelector('input')!.dispatchEvent(paste);
      await settle();
      expect(spy.mock.calls[0][0]).toEqual([pasted]);
    });
  });

  it('walks a dropped directory and passes the files inside it', async () => {
    app = await mountWidget();
    const spy = vi.spyOn(app.fm, 'addForUpload').mockImplementation(() => {});
    const inner = new File(['x'], 'inner.txt');
    const reader = {
      batches: [[{ isDirectory: false, file: (ok: (f: File) => void) => ok(inner) }], []],
      readEntries(ok: (entries: unknown[]) => void) {
        ok(this.batches.shift() ?? []);
      },
    };
    const entry = { isDirectory: true, createReader: () => reader };
    const items = [{ webkitGetAsEntry: () => entry, getAsFile: () => null }];
    root().dispatchEvent(dragEvent('drop', ['Files'], { items }));
    await settle();
    expect(spy.mock.calls[0][0]).toEqual([inner]);
  });
});

