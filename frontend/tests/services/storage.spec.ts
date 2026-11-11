import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaults } from '../../src/config/defaults.ts';
import { getItem, initialLocale, initialView, setItem, storeLocale, storeView } from '../../src/services/storage.ts';

const config = createDefaults();

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

function blockStorage(): void {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('quota', 'QuotaExceededError');
  });
}

describe('getItem / setItem', () => {
  it('round-trip through localStorage', () => {
    setItem('k', 'v');
    expect(getItem('k')).toBe('v');
    expect(window.localStorage.getItem('k')).toBe('v');
    expect(getItem('missing')).toBeNull();
  });

  it('never throw when localStorage throws', () => {
    blockStorage();
    expect(getItem('k')).toBeNull();
    expect(() => setItem('k', 'v')).not.toThrow();
  });

  it('never throw when accessing window.localStorage itself throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(getItem('k')).toBeNull();
    expect(() => setItem('k', 'v')).not.toThrow();
  });
});

describe('initialView', () => {
  it('defaults to the icon view', () => {
    expect(initialView(config)).toBe('main-icons.html');
  });

  it('returns the stored view under the legacy key', () => {
    window.localStorage.setItem('viewTemplate', 'main-table.html');
    expect(initialView(config)).toBe('main-table.html');
  });

  it('falls back from the preview view while it is disabled, without touching storage', () => {
    window.localStorage.setItem('viewTemplate', 'main-icons-preview.html');
    expect(initialView({ enableIconPreviewView: false })).toBe('main-icons.html');
    expect(window.localStorage.getItem('viewTemplate')).toBe('main-icons-preview.html');
    expect(initialView({ enableIconPreviewView: true })).toBe('main-icons-preview.html');
  });

  it('falls back for an unknown stored name', () => {
    window.localStorage.setItem('viewTemplate', 'main-gallery.html');
    expect(initialView(config)).toBe('main-icons.html');
  });

  it('falls back when storage is blocked', () => {
    blockStorage();
    expect(initialView(config)).toBe('main-icons.html');
  });

  it('storeView writes the legacy file name', () => {
    storeView('main-table.html');
    expect(window.localStorage.getItem('viewTemplate')).toBe('main-table.html');
  });
});

describe('initialLocale', () => {
  it('uses the configured default without query or storage', () => {
    expect(initialLocale({ defaultLang: 'de' }, '')).toBe('de');
  });

  it('prefers the stored value over the default', () => {
    window.localStorage.setItem('language', 'fr');
    expect(initialLocale({ defaultLang: 'de' }, '')).toBe('fr');
  });

  it('lets the lang query parameter win and stores it', () => {
    window.localStorage.setItem('language', 'fr');
    expect(initialLocale({ defaultLang: 'de' }, '?lang=it')).toBe('it');
    expect(window.localStorage.getItem('language')).toBe('it');
  });

  it('ignores an empty lang parameter', () => {
    window.localStorage.setItem('language', 'fr');
    expect(initialLocale({ defaultLang: 'de' }, '?lang=')).toBe('fr');
    expect(window.localStorage.getItem('language')).toBe('fr');
  });

  it('reads window.location.search when no search is passed', () => {
    window.history.replaceState(null, '', '/?lang=es');
    try {
      expect(initialLocale({ defaultLang: 'de' })).toBe('es');
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });

  it('still returns the query value when storage is blocked', () => {
    blockStorage();
    expect(initialLocale({ defaultLang: 'de' }, '?lang=it')).toBe('it');
    expect(initialLocale({ defaultLang: 'de' }, '')).toBe('de');
  });

  it('storeLocale writes the legacy key', () => {
    storeLocale('pt');
    expect(window.localStorage.getItem('language')).toBe('pt');
  });
});
