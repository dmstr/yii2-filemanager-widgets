import { computed, createApp, defineComponent, h } from 'vue';
import { describe, expect, it } from 'vitest';
import { createI18n, provideI18n, useI18n } from '../../src/i18n/index.ts';

describe('translator', () => {
  it('returns known keys', () => {
    expect(createI18n('en').t('new_folder')).toBe('New folder');
    expect(createI18n('de').t('new_folder')).not.toBe('new_folder');
  });

  it('returns the key for unknown keys and unknown locales', () => {
    expect(createI18n('en').t('no_such_key')).toBe('no_such_key');
    expect(createI18n('en').t('constructor')).toBe('constructor');
    expect(createI18n('de-DE').t('new_folder')).toBe('new_folder');
  });

  it('returns the key where a language lacks it', () => {
    expect(createI18n('he').t('these_elements', { total: 3 })).toBe('these_elements');
  });

  it('interpolates, with optional whitespace, and renders a missing param as empty', () => {
    const i18n = createI18n('en');
    const raw = 'these_elements';
    const withParam = i18n.t(raw, { total: 5 });
    expect(withParam).toContain('5');
    expect(withParam).not.toContain('{{');
    const without = i18n.t(raw);
    expect(without).not.toContain('{{');
    expect(without).not.toContain('undefined');
    expect(without).toBe(withParam.replace('5', ''));
  });

  it('updates a computed when the locale switches', () => {
    const i18n = createI18n('en');
    const label = computed(() => i18n.t('new_folder'));
    const before = label.value;
    i18n.use('de');
    expect(label.value).not.toBe(before);
    i18n.use('xx');
    expect(label.value).toBe('new_folder');
  });

  it('useI18n throws without provider and works with one', () => {
    const Child = defineComponent({ setup: () => { useI18n(); return () => h('i'); } });
    expect(() => createApp(Child).mount(document.createElement('div'))).toThrow(/i18n/);

    let got: unknown;
    const inst = createI18n('en');
    const Probe = defineComponent({ setup: () => { got = useI18n(); return () => h('i'); } });
    const Root = defineComponent({ setup: () => { provideI18n(inst); return () => h(Probe); } });
    createApp(Root).mount(document.createElement('div'));
    expect(got).toBe(inst);
  });
});
