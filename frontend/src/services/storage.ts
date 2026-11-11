import type { FileManagerConfig } from '../config/types.ts';
import { getQueryParam } from '../utils/query.ts';

/**
 * The stored values are the AngularJS template file names so that existing
 * users keep the view they chose.
 */
export const VIEW_NAMES = ['main-icons.html', 'main-table.html', 'main-icons-preview.html'] as const;
export type ViewName = (typeof VIEW_NAMES)[number];

const VIEW_KEY = 'viewTemplate';
const LANGUAGE_KEY = 'language';

/** `localStorage.getItem` that returns `null` instead of throwing when storage is blocked. */
export function getItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** `localStorage.setItem` that silently does nothing when storage is blocked or full. */
export function setItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage is a convenience only.
  }
}

/**
 * Port of `initTemplate()`: the stored view, except that the preview view
 * falls back to the icon view while it is disabled (the stored value is left
 * untouched). A stored name that is none of the three views, which the AngularJS
 * code would have tried to include as a missing template, also falls back.
 */
export function initialView(config: Pick<FileManagerConfig, 'enableIconPreviewView'>): ViewName {
  const stored = getItem(VIEW_KEY);
  if (!stored) {
    return 'main-icons.html';
  }
  if (stored === 'main-icons-preview.html' && !config.enableIconPreviewView) {
    return 'main-icons.html';
  }
  return (VIEW_NAMES as readonly string[]).includes(stored) ? (stored as ViewName) : 'main-icons.html';
}

export function storeView(name: ViewName): void {
  setItem(VIEW_KEY, name);
}

/**
 * Port of `changeLanguage(getQueryParam('lang'))`: a `lang` query parameter
 * wins and is stored, otherwise the stored value, otherwise the configured
 * default.
 */
export function initialLocale(config: Pick<FileManagerConfig, 'defaultLang'>, search?: string): string {
  const fromQuery = getQueryParam('lang', search);
  if (fromQuery) {
    storeLocale(fromQuery);
    return fromQuery;
  }
  return getItem(LANGUAGE_KEY) || config.defaultLang;
}

export function storeLocale(locale: string): void {
  setItem(LANGUAGE_KEY, locale);
}
