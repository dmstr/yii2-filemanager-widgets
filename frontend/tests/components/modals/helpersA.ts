/** Shared setup for the dialog specs of this group: a mounted dialog on a real file manager state, selection helpers and a comparison with the legacy markup. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h, nextTick, reactive, type Component } from 'vue';
import { provideConfig } from '../../../src/config/injection.ts';
import { provideI18n } from '../../../src/i18n/index.ts';
import type { Item } from '../../../src/models/Item.ts';
import { createFileManager, provideFileManager, type FileManager } from '../../../src/services/fileManager.ts';
import { dir, file, makeConfig, makeI18n, makeItem } from '../../services/helpers.ts';

export { dir, file, makeItem };

export interface MountedModal {
  wrapper: VueWrapper;
  fm: FileManager;
  /** The translator the dialog uses. */
  t: (key: string) => string;
}

/** Mounts one dialog the way the app provides its services (config, translator, file manager state). */
export function mountModal(component: Component): MountedModal {
  const config = makeConfig();
  const i18n = makeI18n();
  const fm = createFileManager(config, i18n);
  const Host = defineComponent({
    setup() {
      provideConfig(config);
      provideI18n(i18n);
      provideFileManager(fm);
      return () => h(component);
    },
  });
  return { wrapper: mount(Host, { attachTo: document.body }), fm, t: (key) => i18n.t(key) };
}

/** A selectable item in its reactive form, which is how the app stores items. */
export const item = (name: string, type: 'file' | 'dir' = 'file'): Item =>
  reactive(makeItem(type === 'dir' ? dir(name) : file(name), ['sub'])) as Item;

/** Replaces the selection and waits for the render. */
export async function select(fm: FileManager, ...items: Array<Item | undefined>): Promise<void> {
  fm.temps = items;
  await nextTick();
}

/** A test-utils wrapper or a plain element. */
type Wrapped = { element: Element } | Element;

/** Text with collapsed whitespace, as the browser shows it. */
export const text = (wrapper: Wrapped): string =>
  ('element' in wrapper ? wrapper.element : wrapper).textContent!.replace(/\s+/g, ' ').trim();

/** Text a user sees: collapsed whitespace, elements hidden by `v-show` left out. */
export function visibleText(root: Wrapped): string {
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (!(node instanceof HTMLElement) || node.style.display === 'none') return '';
    return [...node.childNodes].map(walk).join('');
  };
  return walk('element' in root ? root.element : root).replace(/\s+/g, ' ').trim();
}

export const isHidden = (el: Element): boolean => (el as HTMLElement).style.display === 'none';

/** Waits for the render after a state change. */
export const rendered = (app: MountedModal): Promise<void> => app.wrapper.vm.$nextTick();

const LEGACY_FILE = resolve(process.cwd(), '../_tasks/2026-11-11_vue3-port/legacy-templates/modals.html');

/** `_tasks` is git-ignored: comparisons against the legacy markup run only where the file exists. */
export const legacyAvailable = existsSync(LEGACY_FILE);

/** The `.modal-content` element of a legacy dialog, parsed from the extracted template. */
export function legacyContent(id: string): Element {
  const doc = new DOMParser().parseFromString(readFileSync(LEGACY_FILE, 'utf8'), 'text/html');
  return doc.querySelector(`#${id} .modal-content`)!;
}

const ignoredAttribute = (name: string): boolean => /^(ng-|data-|style$|disabled$|value$)/.test(name);

/** Own text of an element with the legacy `{{'key' | translate}}` filters resolved and other expressions emptied. */
function ownText(el: Element, legacy: boolean, translate: (key: string) => string): string {
  const raw = [...el.childNodes]
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent ?? '')
    .join('');
  const resolved = legacy
    ? raw
        .replace(/\{\{\s*(["'])(.+?)\1\s*\|\s*translate\s*\}\}/g, (_m, _q, key: string) => translate(key))
        .replace(/\{\{.*?\}\}/g, '')
    : raw;
  return resolved.replace(/\s+/g, ' ').trim();
}

function attributes(el: Element, legacy: boolean): Record<string, string> {
  const result: Record<string, string> = {};
  for (const { name, value } of [...el.attributes]) {
    if (ignoredAttribute(name)) continue;
    // `alt="{{...}}"` interpolates to the empty string for an empty selection.
    result[name] = legacy ? value.replace(/\{\{.*?\}\}/g, '') : value;
  }
  // `autofocus` is a boolean attribute; its value carries no meaning.
  if ('autofocus' in result) result.autofocus = '';
  if (result.class) result.class = result.class.split(/\s+/).sort().join(' ');
  return result;
}

/**
 * Compares tag, attributes (without `ng-*`, `data-*`, `style`, `disabled`), own
 * text and children of a rendered dialog with its legacy template. Where the
 * legacy template includes a partial (`ng-include`) only the wrapper element
 * is compared; the partials belong to other components. Returns the first
 * difference as a path, or `null` when equal.
 */
export function diffAgainstLegacy(legacy: Element, rendered: Element, translate: (key: string) => string, path = ''): string | null {
  const here = `${path}/${legacy.tagName.toLowerCase()}`;
  if (legacy.tagName !== rendered.tagName) return `${here}: tag ${rendered.tagName}`;
  const a = JSON.stringify(attributes(legacy, true));
  const b = JSON.stringify(attributes(rendered, false));
  if (a !== b) return `${here}: attributes ${b} instead of ${a}`;
  if (legacy.hasAttribute('ng-include')) return null;
  const textA = ownText(legacy, true, translate);
  const textB = ownText(rendered, false, translate);
  if (textA !== textB) return `${here}: text "${textB}" instead of "${textA}"`;
  const childrenA = [...legacy.children];
  const childrenB = [...rendered.children];
  if (childrenA.length !== childrenB.length) return `${here}: ${childrenB.length} children instead of ${childrenA.length}`;
  for (let i = 0; i < childrenA.length; i++) {
    const diff = diffAgainstLegacy(childrenA[i], childrenB[i], translate, `${here}[${i}]`);
    if (diff) return diff;
  }
  return null;
}
