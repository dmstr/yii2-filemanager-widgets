import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import ErrorBar from '../../../src/components/modals/ErrorBar.vue';
import { provideConfig } from '../../../src/config/injection.ts';
import { provideI18n } from '../../../src/i18n/index.ts';
import { createFileManager, provideFileManager } from '../../../src/services/fileManager.ts';
import { makeConfig, makeI18n } from '../../services/helpers.ts';

function mountBar() {
  const config = makeConfig();
  const i18n = makeI18n();
  const fm = createFileManager(config, i18n);
  const Host = defineComponent({
    setup() {
      provideConfig(config);
      provideI18n(i18n);
      provideFileManager(fm);
      return () => h(ErrorBar);
    },
  });
  return { wrapper: mount(Host), fm };
}

describe('ErrorBar', () => {
  it('renders the include wrapper and the AngularJS error label', () => {
    const { wrapper } = mountBar();
    const root = wrapper.element as HTMLElement;
    expect(root.tagName).toBe('DIV');
    expect(root.className).toBe('clearfix');
    const label = root.firstElementChild as HTMLElement;
    expect(label.className).toBe('label label-danger error-msg pull-left animated fadeIn');
    expect(label.querySelector('i')!.className).toBe('glyphicon glyphicon-remove-circle');
  });

  it('is shown exactly while the API has an error (ng-show)', async () => {
    const { wrapper, fm } = mountBar();
    const label = wrapper.element.firstElementChild as HTMLElement;
    expect(label.style.display).toBe('none');
    fm.api.error = 'Something failed';
    await nextTick();
    expect(label.style.display).toBe('');
    expect(label.querySelector('span')!.textContent).toBe('Something failed');
    fm.api.error = '';
    await nextTick();
    expect(label.style.display).toBe('none');
  });
});
