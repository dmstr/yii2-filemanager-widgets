import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import ModalsHost from '../../../src/components/modals/ModalsHost.vue';
import { provideConfig } from '../../../src/config/injection.ts';
import { provideI18n } from '../../../src/i18n/index.ts';
import { createFileManager, provideFileManager } from '../../../src/services/fileManager.ts';
import { makeConfig, makeI18n } from '../../services/helpers.ts';

describe('ModalsHost', () => {
  it('renders the thirteen dialogs in the order of the AngularJS dialog templates, all hidden', () => {
    const config = makeConfig();
    const i18n = makeI18n();
    const fm = createFileManager(config, i18n);
    const Host = defineComponent({
      setup() {
        provideConfig(config);
        provideI18n(i18n);
        provideFileManager(fm);
        return () => h('div', [h(ModalsHost)]);
      },
    });
    const wrapper = mount(Host, { attachTo: document.body });
    const modals = [...wrapper.element.children].filter((el) => el.classList.contains('modal'));
    expect(modals.map((el) => el.id)).toEqual([
      'imagepreview', 'remove', 'move', 'rename', 'copy', 'compress', 'extract',
      'edit', 'newfolder', 'uploadfile', 'changepermissions', 'downloadlink', 'selector',
    ]);
    expect(modals.every((el) => !el.classList.contains('in'))).toBe(true);
    expect(document.querySelectorAll('.modal-backdrop')).toHaveLength(0);
    wrapper.unmount();
  });
});
