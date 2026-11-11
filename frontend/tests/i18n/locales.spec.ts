import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '../../src/i18n';

const legacyPath = resolve(__dirname, '../../../src/assets/dist/angular-filemanager.min.js');

/** Evaluates the legacy $translateProvider blocks with a stub provider. */
function loadLegacy(): Record<string, Record<string, string>> {
  const lines = readFileSync(legacyPath, 'utf8').split('\n');
  const start = lines.findIndex((l) => l.includes("$translateProvider.useSanitizeValueStrategy"));
  const first = lines.findIndex((l) => l.includes("$translateProvider.translations('en'"));
  expect(start).toBeGreaterThan(0);
  const end = lines.findIndex((l, i) => i > first && /^\}\]\);?\s*$|^\s*\}\]\);\s*$/.test(l));
  const body = lines.slice(start, end).join('\n');
  const out: Record<string, Record<string, string>> = {};
  const provider = {
    useSanitizeValueStrategy() {},
    translations(lang: string, o: Record<string, string>) {
      out[lang] = o;
    },
  };
  new Function('$translateProvider', body)(provider);
  return out;
}

const legacy = loadLegacy();
const counts: Record<string, number> = { en: 99, de: 99, he: 91 };

describe('locale parity with legacy source', () => {
  it('finds all 12 legacy languages', () => {
    expect(Object.keys(legacy).sort()).toEqual([...LOCALES].sort());
  });

  for (const lang of LOCALES) {
    it(`${lang}: same keys, order and values`, async () => {
      const mod = (await import(`../../src/i18n/locales/${lang}.ts`)).default as Record<string, string>;
      expect(Object.keys(mod)).toEqual(Object.keys(legacy[lang]));
      expect(Object.values(mod)).toEqual(Object.values(legacy[lang]));
    });

    it(`${lang}: key count`, async () => {
      const mod = (await import(`../../src/i18n/locales/${lang}.ts`)).default as Record<string, string>;
      expect(Object.keys(mod)).toHaveLength(counts[lang] ?? 92);
    });
  }
});
