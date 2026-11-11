import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick, reactive } from 'vue';
import PathSelector from '../../../src/components/modals/PathSelector.vue';
import { provideConfig } from '../../../src/config/injection.ts';
import { provideI18n } from '../../../src/i18n/index.ts';
import type { Item } from '../../../src/models/Item.ts';
import { createFileManager, provideFileManager } from '../../../src/services/fileManager.ts';
import { dir, file, makeConfig, makeI18n, makeItem, stubFetch } from '../../services/helpers.ts';

function mountSelector() {
  const requests = stubFetch(() => ({ body: { result: [dir('sub')] } }));
  const config = makeConfig();
  const i18n = makeI18n();
  const fm = createFileManager(config, i18n);
  const closes: number[] = [];
  const Host = defineComponent({
    setup() {
      provideConfig(config);
      provideI18n(i18n);
      provideFileManager(fm);
      return () => h(PathSelector, { onClose: () => closes.push(1) });
    },
  });
  return { wrapper: mount(Host), fm, closes, requests };
}

const item = (name: string, path: string[] = []): Item => reactive(makeItem(file(name), path)) as Item;
const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();
/** What a user sees: elements hidden by v-show left out. */
function visibleText(node: Node): string {
  const walk = (n: Node): string => {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent ?? '';
    if (!(n instanceof HTMLElement) || n.style.display === 'none') return '';
    return [...n.childNodes].map(walk).join('');
  };
  return squash(walk(node));
}

describe('PathSelector', () => {
  it('renders the include wrapper and the legacy panel with its nested footer (Q-10)', () => {
    const { wrapper } = mountSelector();
    const root = wrapper.element as HTMLElement;
    expect(root.className).toBe('clearfix');
    const panel = root.firstElementChild as HTMLElement;
    expect(panel.className).toBe('panel panel-primary mt10 mb0');
    expect([...panel.children].map((c) => c.className)).toEqual(['panel-body', 'modal-footer']);
    expect(panel.querySelectorAll('.detail-sources')).toHaveLength(2);
    expect(panel.querySelector('.detail-sources .like-code.mr5 > span')).not.toBeNull();
    const link = panel.querySelector('a.label.label-primary:not(.selected-file-details a)')!;
    expect(link.getAttribute('href')).toBe('');
    const button = panel.querySelector('.modal-footer > button')!;
    expect(button.className).toBe('btn btn-default');
    expect(button.getAttribute('type')).toBe('button');
    expect(squash(button.textContent!)).toBe('Close');
  });

  it('shows the selection and the destination of a single file', async () => {
    const { wrapper, fm } = mountSelector();
    const selected = item('a.txt', ['docs']);
    fm.temps = [selected];
    fm.selectedModalPath = ['docs', 'target'];
    await nextTick();
    // The key `Selection` has no translation and renders raw, as in legacy.
    expect(visibleText(wrapper.findAll('.like-code')[0].element)).toBe('Selection: a.txt');
    expect(squash(wrapper.findAll('.like-code')[1].text())).toBe('Destination: /docs/target/a.txt');
  });

  it('does not throw for an empty selection (Q-29)', async () => {
    const { wrapper, fm } = mountSelector();
    fm.temps = [];
    await nextTick();
    expect(squash(wrapper.findAll('.like-code')[1].text())).toBe('Destination: /');
  });

  it('opens the destination dialog at the main navigator path', async () => {
    const { wrapper, fm, requests } = mountSelector();
    fm.navigator.currentPath = ['docs'];
    const link = wrapper.findAll('.detail-sources')[1].find('a');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(fm.modals.isOpen('selector')).toBe(true);
    expect(fm.selector.navigator.currentPath).toEqual(['docs']);
    expect(requests[0].body).toMatchObject({ action: 'list', path: '/docs' });
  });

  it('emits close from the nested close button and disables it while a request runs', async () => {
    const { wrapper, fm, closes } = mountSelector();
    const button = wrapper.find('.modal-footer button');
    await button.trigger('click');
    expect(closes).toEqual([1]);
    fm.api.inprocess = true;
    await nextTick();
    expect((button.element as HTMLButtonElement).disabled).toBe(true);
  });
});
