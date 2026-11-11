import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountWidget, settle, type Mounted } from './helpers.ts';

let app: Mounted;
afterEach(() => {
  app?.wrapper.unmount();
  vi.useRealTimers();
});

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

  it('ignores drags that carry no files', async () => {
    app = await mountWidget();
    const event = dragEvent('dragover', ['text/plain']);
    root().dispatchEvent(event);
    await app.wrapper.vm.$nextTick();
    expect(root().classList.contains('upload-dragover')).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });

  it('allows the drop and copies by default', async () => {
    app = await mountWidget();
    const event = dragEvent('dragover');
    root().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect((event as unknown as { dataTransfer: { dropEffect: string } }).dataTransfer.dropEffect).toBe('copy');
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

  it('does not call addForUpload for a drop without files', async () => {
    app = await mountWidget();
    const spy = vi.spyOn(app.fm, 'addForUpload').mockImplementation(() => {});
    root().dispatchEvent(dragEvent('drop', ['Files'], { files: [] }));
    await settle();
    expect(spy).not.toHaveBeenCalled();
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

