/**
 * Minimal translator replacing angular-translate 2.9.2: no sanitizing. A key is
 * looked up in the current language, then in the base language of a code with a
 * region (`de-DE`), then in `en`, and only then returned as is. Which locale to
 * start with is decided elsewhere and passed in.
 */
import { inject, provide, ref, type InjectionKey, type Ref } from 'vue';
import en from './locales/en.ts';
import he from './locales/he.ts';
import pt from './locales/pt.ts';
import es from './locales/es.ts';
import fr from './locales/fr.ts';
import de from './locales/de.ts';
import sk from './locales/sk.ts';
import zh from './locales/zh.ts';
import ru from './locales/ru.ts';
import ua from './locales/ua.ts';
import tr from './locales/tr.ts';
import fa from './locales/fa.ts';

const catalogs: Record<string, Record<string, string>> = {
  en, he, pt, es, fr, de, sk, zh, ru, ua, tr, fa,
};

export interface I18n {
  /** Current locale code; may be a code without a table (lookups then fall back to `en`). */
  locale: Ref<string>;
  use(locale: string): void;
  t(key: string, params?: Record<string, unknown>): string;
}

const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** Renders a value the way AngularJS $interpolate does: undefined and null become ''. */
function render(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function interpolate(text: string, params: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([\w$]+(?:\.[\w$]+)*)\s*\}\}/g, (_m, path: string) => {
    let value: unknown = params;
    for (const part of path.split('.')) {
      if (value === undefined || value === null) return '';
      value = (value as Record<string, unknown>)[part];
    }
    return render(value);
  });
}

/** The tables to try for a locale code, most specific first; `de_DE` and `DE-de` resolve to `de`. */
function chain(code: string): Record<string, string>[] {
  const names = [has(catalogs, code) ? code : code.toLowerCase().split(/[-_]/)[0], 'en'];
  return names.filter((name) => has(catalogs, name)).map((name) => catalogs[name]);
}

/** Creates a translator; `t` reads the reactive locale, so templates and computeds re-run on `use()`. */
export function createI18n(initialLocale: string): I18n {
  const locale = ref(initialLocale);
  return {
    locale,
    use(next: string) {
      locale.value = next;
    },
    t(key, params = {}) {
      const table = chain(locale.value).find((candidate) => has(candidate, key));
      return table ? interpolate(table[key], params) : key;
    },
  };
}

export const I18N_KEY: InjectionKey<I18n> = Symbol('i18n');

/** Makes the instance available to all descendants of the calling component. */
export function provideI18n(instance: I18n): void {
  provide(I18N_KEY, instance);
}

/** Returns the provided instance or throws when no ancestor called `provideI18n`. */
export function useI18n(): I18n {
  const instance = inject(I18N_KEY, null);
  if (!instance) throw new Error('useI18n(): no i18n instance provided; call provideI18n() in an ancestor component');
  return instance;
}
