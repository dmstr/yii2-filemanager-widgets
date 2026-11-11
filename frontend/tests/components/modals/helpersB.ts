/** Shared setup for the dialog specs of the compress/extract/edit/upload/permissions/link group: mounting, selection helpers and a comparison with the legacy markup. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h, nextTick, reactive, type Component } from 'vue';
import { provideConfig } from '../../../src/config/injection.ts';
import type { FileManagerConfig } from '../../../src/config/types.ts';
import { provideI18n } from '../../../src/i18n/index.ts';
import type { Item } from '../../../src/models/Item.ts';
import { createFileManager, provideFileManager, type FileManager } from '../../../src/services/fileManager.ts';
import { dir, file, makeConfig, makeI18n, makeItem } from '../../services/helpers.ts';

export { dir, file, makeItem };

export interface MountedModal {
  wrapper: VueWrapper;
  fm: FileManager;
  config: FileManagerConfig;
  /** The translator the dialog uses. */
  t: (key: string) => string;
}

/** Mounts one dialog the way the app provides its services (config, translator, file manager state). */
export function mountModal(component: Component, configure?: (config: FileManagerConfig) => void): MountedModal {
  const config = makeConfig();
  configure?.(config);
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
  return { wrapper: mount(Host, { attachTo: document.body }), fm, config, t: (key) => i18n.t(key) };
}

/** A selectable item in its reactive form, which is how the app stores items. */
export const item = (name: string, type: 'file' | 'dir' = 'file'): Item =>
  reactive(makeItem(type === 'dir' ? dir(name) : file(name), ['sub'])) as Item;

/** Replaces the selection and waits for the render. */
export async function select(fm: FileManager, ...items: Array<Item | undefined>): Promise<void> {
  fm.temps = items;
  await nextTick();
}

/** Text with collapsed whitespace, as the browser shows it. */
export type Wrapped = VueWrapper | DOMWrapper<Element> | Element;
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

const LEGACY_FILE = resolve(process.cwd(), '../_tasks/2026-11-11_vue3-port/legacy-templates/modals.html');

/** `_tasks` is git-ignored: comparisons against the legacy markup run only where the file exists. */
export const legacyAvailable = existsSync(LEGACY_FILE);

/** The `.modal-content` of a legacy dialog; `drop` removes subtrees (an `ng-if` branch that is not rendered). */
export function legacyContent(id: string, drop: string[] = []): Element {
  const doc = new DOMParser().parseFromString(readFileSync(LEGACY_FILE, 'utf8'), 'text/html');
  const content = doc.querySelector(`#${id} .modal-content`)!;
  for (const selector of drop) {
    content.querySelectorAll(selector).forEach((el) => el.remove());
  }
  return content;
}

const ignoredAttribute = (name: string): boolean => /^(ng-|ngf-|ngclipboard|data-|style$|disabled$|value$|isteven-multi-select$|input-model$|output-model$|button-label$|item-label$|tick-property$|output-properties$)/.test(name);

/**
 * Own text of an element with whitespace collapsed. For legacy text the
 * `{{'key' | translate}}` filters are resolved; any other expression is
 * data and becomes a `\u0000` marker that matches whatever was rendered.
 */
function ownText(el: Element, legacy: boolean, translate: (key: string) => string): string {
  const raw = [...el.childNodes]
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent ?? '')
    .join('');
  const resolved = legacy
    ? raw
        .replace(/\{\{\s*(["'])(.+?)\1\s*\|\s*translate\s*\}\}/g, (_m, _q, key: string) => translate(key))
        .replace(/\{\{.*?\}\}/g, '\u0000')
    : raw;
  return resolved.replace(/\s+/g, ' ').trim();
}

const textMatches = (legacyText: string, renderedText: string): boolean =>
  new RegExp('^' + legacyText.split('\u0000').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(renderedText);

/** Attribute map; a legacy value with `{{...}}` becomes a pattern, because the rendered value is data. */
function attributes(el: Element): Record<string, string> {
  const result: Record<string, string> = {};
  for (const { name, value } of [...el.attributes]) {
    if (ignoredAttribute(name)) continue;
    result[name] = value;
  }
  // Boolean `autofocus` is reflected as "" by the DOM property.
  if ('autofocus' in result) result.autofocus = '';
  // AngularJS 1.5 adds autocomplete="off" to every hidden input with ng-model when it compiles the template.
  if (el.localName === 'input' && el.getAttribute('type') === 'hidden' && el.hasAttribute('ng-model')) result.autocomplete = 'off';
  if (result.class) result.class = result.class.split(/\s+/).sort().join(' ');
  return result;
}

const matchesPattern = (legacyValue: string, renderedValue: string): boolean =>
  new RegExp('^' + legacyValue.split(/\{\{.*?\}\}/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(renderedValue);

/**
 * Compares tag, attributes (without `ng-*`, `ngf-*`, `data-*`, `style`, `disabled`, `value`), own
 * text and children of a rendered dialog with its legacy template. `ng-include` wrappers compare
 * only the wrapper (the partials belong to other components), the `isteven-multi-select` element
 * only its class and tag, and one `ng-repeat` child is cloned to the number of rendered rows.
 * Returns the first difference as a path, or `null` when equal.
 */
export function diffAgainstLegacy(legacy: Element, rendered: Element, translate: (key: string) => string, path = ''): string | null {
  const here = `${path}/${legacy.tagName.toLowerCase()}`;
  if (legacy.tagName !== rendered.tagName) return `${here}: tag ${rendered.tagName}`;
  if (legacy.hasAttribute('isteven-multi-select')) {
    return rendered.classList.contains('permission-multi-select-button') ? null : `${here}: lost class permission-multi-select-button`;
  }
  const a = attributes(legacy);
  const b = attributes(rendered);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (!(key in a) || !(key in b) || !matchesPattern(a[key], b[key])) {
      return `${here}: attribute ${key} is ${JSON.stringify(b[key])} instead of ${JSON.stringify(a[key])}`;
    }
  }
  if (legacy.hasAttribute('ng-include')) return null;
  const rawLegacy = [...legacy.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('');
  // `{{key | translate}}` of an API-provided key: the rendered text is the translated key.
  if (!/\{\{\s*\w+\s*\|\s*translate\s*\}\}/.test(rawLegacy)) {
    const textA = ownText(legacy, true, translate);
    const textB = ownText(rendered, false, translate);
    if (!textMatches(textA, textB)) return `${here}: text "${textB}" instead of "${textA.replace(/\u0000/g, '{...}')}"`;
  }
  let childrenA = [...legacy.children];
  const childrenB = [...rendered.children];
  const repeatAt = childrenA.findIndex((c) => c.hasAttribute('ng-repeat'));
  if (repeatAt !== -1) {
    const rows = childrenB.length - (childrenA.length - 1);
    childrenA = [...childrenA.slice(0, repeatAt), ...Array.from({ length: Math.max(rows, 0) }, () => childrenA[repeatAt]), ...childrenA.slice(repeatAt + 1)];
  }
  if (childrenA.length !== childrenB.length) return `${here}: ${childrenB.length} children instead of ${childrenA.length}`;
  for (let i = 0; i < childrenA.length; i++) {
    const diff = diffAgainstLegacy(childrenA[i], childrenB[i], translate, `${here}[${i}]`);
    if (diff) return diff;
  }
  return null;
}
