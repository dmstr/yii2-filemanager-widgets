import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick, reactive } from 'vue';
import SelectorModal from '../../../src/components/modals/SelectorModal.vue';
import { provideConfig } from '../../../src/config/injection.ts';
import { provideI18n } from '../../../src/i18n/index.ts';
import type { Item } from '../../../src/models/Item.ts';
import type { RawItem } from '../../../src/models/Item.ts';
import { createFileManager, provideFileManager, type FileManager } from '../../../src/services/fileManager.ts';
import { humanReadableFileSize } from '../../../src/utils/format.ts';
import { dir, file, flush, makeConfig, makeI18n, makeItem, stubFetch, type FakeReply, type RecordedRequest } from '../../services/helpers.ts';

let wrapper: VueWrapper | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

const listing: RawItem[] = [dir('beta'), file('readme.txt'), dir('alpha'), dir('a-very-long-folder-name-that-is-cut-after-32')];

function mountSelector(reply: (request: RecordedRequest) => FakeReply | Promise<FakeReply> = () => ({ body: { result: listing } })) {
  const requests = stubFetch(reply);
  const config = makeConfig();
  const i18n = makeI18n();
  const fm = createFileManager(config, i18n);
  const Host = defineComponent({
    setup() {
      provideConfig(config);
      provideI18n(i18n);
      provideFileManager(fm);
      return () => h(SelectorModal);
    },
  });
  wrapper = mount(Host, { attachTo: document.body });
  return { wrapper, fm, requests };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) await flush();
}

/** Opens the dialog the way the path selector does and waits for the listing. */
async function open(fm: FileManager, path: string[] = ['docs']): Promise<void> {
  fm.openNavigator(path);
  await settle();
}

const shown = (el: Element): boolean => (el as HTMLElement).style.display !== 'none';
const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();
const bodyRows = (w: VueWrapper) => w.findAll('tbody.file-item > tr');
/** Rows after the three fixed state rows. */
const itemRows = (w: VueWrapper) => bodyRows(w).slice(3);
const visibleItemNames = (w: VueWrapper) => itemRows(w).filter((r) => shown(r.element)).map((r) => squash(r.find('td a').text()));

describe('SelectorModal markup', () => {
  it('renders the AngularJS #selector dialog with breadcrumb, table and buttons', async () => {
    const { wrapper, fm } = mountSelector();
    await open(fm);
    const modal = wrapper.find('#selector');
    expect(modal.classes()).toEqual(['modal', 'animated', 'fadeIn', 'in']);
    expect(squash(modal.find('.modal-title').text())).toBe('Select the destination folder');
    const body = modal.find('.modal-body > div');
    expect(body.element.children[0].firstElementChild!.className).toBe('breadcrumb');
    expect(body.element.children[1].firstElementChild!.className).toBe('table table-condensed table-modal-condensed mb0');
    expect(body.element.children[2].tagName).toBe('HR');
    expect(body.element.children[3].className).toBe('btn btn-sm btn-default');
    expect(squash(body.element.children[3].textContent!)).toBe('Select this');
    expect(modal.find('.modal-footer button').classes()).toEqual(['btn', 'btn-default']);
    // The breadcrumb follows the dialog's own navigator.
    expect(squash(modal.find('.breadcrumb li.active span').text())).toBe('docs');
  });
});

describe('SelectorModal states', () => {
  it('shows only the spinner row while loading', async () => {
    let release: (reply: FakeReply) => void = () => {};
    const { wrapper, fm } = mountSelector(() => new Promise<FakeReply>((resolve) => (release = resolve)));
    fm.openNavigator([]);
    await nextTick();
    const rows = bodyRows(wrapper);
    expect(shown(rows[0].element)).toBe(true);
    expect(rows[0].find('.spinner-wrapper').exists()).toBe(true);
    expect(shown(rows[1].element)).toBe(false);
    expect(shown(rows[2].element)).toBe(false);
    release({ body: { result: listing } });
    await settle();
    expect(shown(bodyRows(wrapper)[0].element)).toBe(false);
  });

  it('lists folders only, sorted by name, with the name cut to 32 characters and the size in the title', async () => {
    const { wrapper, fm } = mountSelector();
    await open(fm);
    expect(visibleItemNames(wrapper)).toEqual(['a-very-long-folder-name-that-is-...', 'alpha', 'beta']);
    // The file row exists but is hidden (ng-show).
    expect(itemRows(wrapper)).toHaveLength(4);
    const alpha = itemRows(wrapper).find((r) => squash(r.text()).startsWith('alpha'))!;
    expect(alpha.find('a').attributes('title')).toBe(`alpha (${humanReadableFileSize(10, false)})`);
    expect(alpha.find('a i').classes()).toEqual(['glyphicon', 'glyphicon-folder-close']);
    expect(squash(alpha.find('button').text())).toBe('Select this');
  });

  it('removes folders that are part of the selection (ng-if)', async () => {
    const { wrapper, fm } = mountSelector();
    fm.temps = [reactive(makeItem(dir('alpha'), ['docs'])) as Item, undefined];
    await open(fm);
    expect(itemRows(wrapper)).toHaveLength(3);
    expect(visibleItemNames(wrapper)).toEqual(['a-very-long-folder-name-that-is-...', 'beta']);
  });

  it('shows the no-folders row with a working go-back button', async () => {
    const { wrapper, fm, requests } = mountSelector((request) =>
      ({ body: { result: (request.body as { path: string }).path === '/docs/empty' ? [file('x.txt')] : listing } }));
    await open(fm, ['docs', 'empty']);
    const row = bodyRows(wrapper)[1];
    expect(shown(row.element)).toBe(true);
    expect(squash(row.find('td').text())).toBe('This folder not contains children folders...');
    expect(visibleItemNames(wrapper)).toEqual([]);
    requests.length = 0;
    await row.find('button').trigger('click');
    await settle();
    expect(requests[0].body).toMatchObject({ path: '/docs' });
    expect(shown(bodyRows(wrapper)[1].element)).toBe(false);
  });

  it('shows the navigator error instead of the no-folders row', async () => {
    const { wrapper, fm } = mountSelector(() => ({ body: { result: { error: 'Not allowed' } } }));
    await open(fm);
    const rows = bodyRows(wrapper);
    expect(shown(rows[1].element)).toBe(false);
    expect(shown(rows[2].element)).toBe(true);
    expect(squash(rows[2].text())).toBe('Not allowed');
  });

  it('sorts by name through its own sort state', async () => {
    const { wrapper, fm } = mountSelector();
    await open(fm);
    const header = wrapper.find('thead a');
    expect(header.attributes('href')).toBe('');
    expect(header.classes()).toEqual(['table-th-label']);
    const marker = header.find('span.sortorder');
    expect(shown(marker.element)).toBe(true);
    expect(marker.classes()).not.toContain('reverse');
    await header.trigger('click');
    expect(fm.selector.reverse).toBe(true);
    expect(fm.reverse).toBe(false);
    expect(marker.classes()).toContain('reverse');
    expect(visibleItemNames(wrapper)).toEqual(['beta', 'alpha', 'a-very-long-folder-name-that-is-...']);
  });
});

describe('SelectorModal actions', () => {
  it('opens a folder on a click on its name', async () => {
    const { wrapper, fm, requests } = mountSelector();
    await open(fm);
    requests.length = 0;
    const alpha = itemRows(wrapper).find((r) => squash(r.text()).startsWith('alpha'))!;
    await alpha.find('a').trigger('click');
    await settle();
    expect(fm.selector.navigator.currentPath).toEqual(['docs', 'alpha']);
    expect(requests[0].body).toMatchObject({ path: '/docs/alpha' });
    expect(fm.navigator.currentPath).toEqual([]);
  });

  it('selects a row with the leading empty segment and closes (Q-40)', async () => {
    const { wrapper, fm } = mountSelector();
    fm.modals.open('move');
    await open(fm);
    const alpha = itemRows(wrapper).find((r) => squash(r.text()).startsWith('alpha'))!;
    await alpha.find('button').trigger('click');
    expect(fm.selectedModalPath).toEqual(['', 'docs', 'alpha']);
    expect(fm.modals.stack).toEqual(['move']);
  });

  it('selects the current folder and closes', async () => {
    const { wrapper, fm } = mountSelector();
    await open(fm, ['docs']);
    await wrapper.find('.modal-body > div > button').trigger('click');
    expect(fm.selectedModalPath).toEqual(['docs']);
    expect(fm.modals.isOpen('selector')).toBe(false);
  });

  it('closes on the cross and on the footer button without clearing the API error', async () => {
    for (const selector of ['.modal-header button.close', '.modal-footer button']) {
      const { wrapper, fm } = mountSelector();
      await open(fm);
      fm.api.error = 'kept';
      await wrapper.find(selector).trigger('click');
      expect(fm.modals.isOpen('selector')).toBe(false);
      expect(fm.api.error).toBe('kept');
      wrapper.unmount();
    }
  });
});
