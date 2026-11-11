import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createI18n } from '../../src/i18n/index.ts';
import { loadFixture } from '../utils/fixtures.ts';

const localesDir = resolve(__dirname, '../../src/i18n/locales');
/** The locale codes with a table: one file per code. */
const LOCALES = readdirSync(localesDir)
  .filter((name) => name.endsWith('.ts'))
  .map((name) => name.slice(0, -3));

/**
 * The keys of every language table of the AngularJS 1.x frontend, in table order (the translations themselves are not recorded).
 * Edited on purpose: `error_get_permissions` was added to en and de after `error_changing_perms`, because the
 * permissions dialog shows it when loading the roles fails and no table of the AngularJS frontend had it. The
 * 13 keys at the end of en and de (`refresh` to `none_selected`) are texts the AngularJS frontend used without
 * defining them or hard-coded; the other languages fall back to en for them.
 */
const recordedKeys = loadFixture<Record<string, string[]>>('i18n/locale-keys.json');
const counts: Record<string, number> = { en: 113, de: 113, he: 91 };

const table = async (lang: string) => (await import(`../../src/i18n/locales/${lang}.ts`)).default as Record<string, string>;
const placeholders = (text: string) => (text.match(/\{\{.*?\}\}/g) ?? []).sort();

describe('locale tables', () => {
  it('has all 12 recorded languages', () => {
    expect(Object.keys(recordedKeys).sort()).toEqual([...LOCALES].sort());
  });

  it('registers every locale file in the translator catalog', async () => {
    for (const lang of LOCALES) {
      const mod = await table(lang);
      const [key, value] = Object.entries(mod)[0];
      expect(createI18n(lang).t(key), lang).toBe(value);
    }
  });

  for (const lang of LOCALES) {
    it(`${lang}: keys and order match the recorded list, every value is a non-empty string with the placeholders of en`, async () => {
      const mod = await table(lang);
      const en = await table('en');
      expect(Object.keys(mod)).toEqual(recordedKeys[lang]);
      for (const [key, value] of Object.entries(mod)) {
        expect(typeof value, `${lang}.${key}`).toBe('string');
        expect(value.trim(), `${lang}.${key}`).not.toBe('');
        if (key in en) expect(placeholders(value), `${lang}.${key}`).toEqual(placeholders(en[key]));
      }
    });

    it(`${lang}: key count`, async () => {
      const mod = await table(lang);
      expect(Object.keys(mod)).toHaveLength(counts[lang] ?? 92);
    });
  }
});
