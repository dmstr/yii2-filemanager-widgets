import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick, reactive } from 'vue';
import SelectedFilesMsg from '../../../src/components/modals/SelectedFilesMsg.vue';
import { provideConfig } from '../../../src/config/injection.ts';
import { provideI18n } from '../../../src/i18n/index.ts';
import type { Item } from '../../../src/models/Item.ts';
import { createFileManager, provideFileManager } from '../../../src/services/fileManager.ts';
import { dir, file, makeConfig, makeI18n, makeItem } from '../../services/helpers.ts';

/** Mounts `count` independent instances side by side, as several dialogs include the partial. */
function mountMsg(count = 1) {
  const config = makeConfig();
  const i18n = makeI18n();
  const fm = createFileManager(config, i18n);
  const Host = defineComponent({
    setup() {
      provideConfig(config);
      provideI18n(i18n);
      provideFileManager(fm);
      return () => h('div', Array.from({ length: count }, () => h(SelectedFilesMsg)));
    },
  });
  return { wrapper: mount(Host), fm };
}

const item = (name: string, folder = false): Item => reactive(makeItem(folder ? dir(name) : file(name))) as Item;
const shown = (el: Element): boolean => (el as HTMLElement).style.display !== 'none';
/** What a user sees: hidden elements left out, whitespace collapsed. */
function visibleText(node: Node): string {
  const walk = (n: Node): string => {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent ?? '';
    if (!(n instanceof HTMLElement) || !shown(n)) return '';
    return [...n.childNodes].map(walk).join('');
  };
  return walk(node).replace(/\s+/g, ' ').trim();
}

describe('SelectedFilesMsg', () => {
  it('keeps the include wrapper span and the legacy structure', () => {
    const { wrapper } = mountMsg();
    const root = wrapper.element.firstElementChild as HTMLElement;
    expect(root.tagName).toBe('SPAN');
    expect([...root.children].map((c) => c.tagName)).toEqual(['SPAN', 'SPAN', 'DIV']);
    expect(root.querySelector('a')!.getAttribute('href')).toBe('');
    expect(root.querySelector('a')!.className).toBe('label label-primary');
    expect(root.querySelector('ul')!.className).toBe('selected-file-details');
  });

  it('shows the name of a single item', async () => {
    const { wrapper, fm } = mountMsg();
    fm.temps = [item('notes.txt')];
    await nextTick();
    expect(visibleText(wrapper.element)).toBe('notes.txt');
  });

  it('renders nothing and does not throw for an empty selection (Q-29)', async () => {
    const { wrapper, fm } = mountMsg();
    fm.temps = [];
    await nextTick();
    expect(visibleText(wrapper.element)).toBe('');
  });

  it('renders an empty name for a selection of one hole, as AngularJS did (Q-39)', async () => {
    const { wrapper, fm } = mountMsg();
    fm.temps = [undefined];
    await nextTick();
    expect(visibleText(wrapper.element)).toBe('');
  });

  it('counts a hole and lists it as an empty entry (Q-39)', async () => {
    const { wrapper, fm } = mountMsg();
    fm.temps = [item('a.txt'), undefined, item('b', true)];
    await nextTick();
    expect(visibleText(wrapper.element)).toBe('these 3 elements + Details');
    await wrapper.find('a').trigger('click');
    expect(visibleText(wrapper.element)).toBe('these 3 elements - Details a.txt b');
    expect(wrapper.findAll('li b').map((b) => b.text())).toEqual(['a.txt', '', 'b']);
  });

  it('toggles the details per instance and prevents the link default', async () => {
    const { wrapper, fm } = mountMsg(2);
    fm.temps = [item('a.txt'), item('b.txt')];
    await nextTick();
    const [first, second] = wrapper.findAll(':scope > span');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    first.find('a').element.dispatchEvent(event);
    await nextTick();
    expect(event.defaultPrevented).toBe(true);
    expect(shown(first.find('div').element)).toBe(true);
    expect(shown(second.find('div').element)).toBe(false);
    expect(first.find('a').text()).toBe('- Details');
    expect(second.find('a').text()).toBe('+ Details');
    await first.find('a').trigger('click');
    expect(shown(first.find('div').element)).toBe(false);
  });

  it('hides the details again when the selection drops to one item, keeping the toggle state', async () => {
    const { wrapper, fm } = mountMsg();
    fm.temps = [item('a.txt'), item('b.txt')];
    await nextTick();
    await wrapper.find('a').trigger('click');
    fm.temps = [item('c.txt')];
    await nextTick();
    expect(visibleText(wrapper.element)).toBe('c.txt');
    fm.temps = [item('a.txt'), item('b.txt')];
    await nextTick();
    expect(wrapper.find('a').text()).toBe('- Details');
  });
});
