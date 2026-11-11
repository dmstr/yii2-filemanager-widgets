import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { provideConfig, useConfig } from '../../src/config/injection.ts';
import { resolveConfig } from '../../src/config/resolve.ts';

describe('provideConfig / useConfig', () => {
  it('hands the provided config to descendants', () => {
    const config = resolveConfig({ appName: 'Injected' });
    let seen: unknown;
    const Child = defineComponent({
      setup() {
        seen = useConfig();
        return () => h('span');
      },
    });
    const Parent = defineComponent({
      setup() {
        provideConfig(config);
        return () => h(Child);
      },
    });
    mount(Parent);
    expect(seen).toBe(config);
  });

  it('throws a clear error when nothing was provided', () => {
    const Lonely = defineComponent({
      setup() {
        useConfig();
        return () => h('span');
      },
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => mount(Lonely)).toThrow(/provideConfig/);
    warn.mockRestore();
  });
});
