import { afterEach, describe, expect, it, vi } from 'vitest';
import CompressModal from '../../../src/components/modals/CompressModal.vue';
import { diffAgainstLegacy, isHidden, item, legacyAvailable, legacyContent, mountModal, select, text, visibleText, type MountedModal } from './helpersB.ts';

let app: MountedModal;
afterEach(() => app?.wrapper.unmount());

const mount = (chooseName = true) =>
  (app = mountModal(CompressModal, (config) => {
    config.allowedActions.compressChooseName = chooseName;
  }));
const body = () => app.wrapper.find('.modal-body');
const input = () => app.wrapper.find('input.form-control');
const cross = () => app.wrapper.find('button.close');
const footerButtons = () => app.wrapper.findAll('.modal-footer button');
const cancel = () => footerButtons()[1];
const submit = () => app.wrapper.find('button[type=submit]');

describe('CompressModal', () => {
  it.runIf(legacyAvailable)('has the structure of the legacy template', () => {
    mount();
    expect(diffAgainstLegacy(legacyContent('compress'), app.wrapper.find('.modal-content').element, app.t)).toBeNull();
  });

  it('renders the name field for a single selection', async () => {
    mount();
    await select(app.fm, item('a.txt'));
    expect(app.wrapper.find('#compress').classes()).toEqual(expect.arrayContaining(['modal', 'animated', 'fadeIn']));
    expect(text(app.wrapper.find('.modal-title'))).toBe(app.t('compress'));
    expect(visibleText(body())).toBe(`${app.t('enter_file_name_for_compression')} a.txt`);
    expect(input().attributes('autofocus')).toBeDefined();
    expect(visibleText(app.wrapper.find('.modal-footer'))).toBe(`${app.t('cancel')} ${app.t('compress')}`);
  });

  it('shows the question instead of the field without compressChooseName', async () => {
    mount(false);
    await select(app.fm, item('a.txt'));
    expect(visibleText(body())).toBe(`${app.t('sure_to_start_compression_with')} a.txt ?`);
    expect(isHidden(input().element.closest('div')!)).toBe(true);
  });

  it('lists the selection for several items and survives an empty selection and a hole', async () => {
    mount();
    await select(app.fm, item('a'), item('b'));
    expect(visibleText(body())).toBe(`${app.t('enter_file_name_for_compression')} these 2 elements + ${app.t('details')}`);
    await select(app.fm);
    expect(visibleText(body())).toBe(app.t('enter_file_name_for_compression'));
    await expect(select(app.fm, undefined)).resolves.toBeUndefined();
    expect(visibleText(body())).toBe(app.t('enter_file_name_for_compression'));
  });

  it('writes the trimmed input to temp.tempModel.name, also for several items', async () => {
    mount();
    await select(app.fm, item('a.txt'));
    await input().setValue('  foo bar  ');
    expect(app.fm.singleSelection()!.tempModel.name).toBe('foo bar');
    await input().setValue('   ');
    expect(app.fm.singleSelection()!.tempModel.name).toBe('');

    await select(app.fm, item('a'), item('b'));
    await input().setValue(' archive ');
    expect(app.fm.temp.tempModel.name).toBe('archive');
  });

  it('keeps what was typed in the field, trailing space included, while the model is trimmed', async () => {
    mount();
    await select(app.fm, item('a.txt'));
    (input().element as HTMLInputElement).focus();
    // `setValue` would also fire `change`, which v-model.trim answers by trimming the field (as on blur).
    (input().element as HTMLInputElement).value = 'foo ';
    await input().trigger('input');
    expect(app.fm.singleSelection()!.tempModel.name).toBe('foo');
    expect((input().element as HTMLInputElement).value).toBe('foo ');
  });

  it('closes on the cross and on Cancel without refreshing', async () => {
    for (const control of [cross, cancel]) {
      mount();
      app.fm.refreshLocation = vi.fn();
      app.fm.modals.open('compress');
      await control().trigger('click');
      expect(app.fm.modals.isOpen('compress')).toBe(false);
      expect(app.fm.refreshLocation).not.toHaveBeenCalled();
      app.wrapper.unmount();
    }
  });

  it('submits through the form and prevents the native submit', async () => {
    mount();
    app.fm.compress = vi.fn();
    const event = new Event('submit', { cancelable: true });
    app.wrapper.find('form').element.dispatchEvent(event);
    expect(app.fm.compress).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    await submit().trigger('click');
    expect(app.fm.compress).toHaveBeenCalledTimes(2);
  });

  it('disables the footer buttons while a request runs', async () => {
    mount();
    app.fm.api.inprocess = true;
    await app.wrapper.vm.$nextTick();
    expect(footerButtons().filter((b) => b.attributes('disabled') !== undefined)).toHaveLength(3);
    expect(cross().attributes('disabled')).toBeUndefined();
    app.fm.api.inprocess = false;
    await app.wrapper.vm.$nextTick();
    expect(footerButtons().every((b) => b.attributes('disabled') === undefined)).toBe(true);
  });

  it('swaps body and footer after an async success', async () => {
    mount();
    await select(app.fm, item('a.txt'));
    app.fm.api.asyncSuccess = true;
    await app.wrapper.vm.$nextTick();
    expect(visibleText(body())).toBe(app.t('compression_started'));
    expect(visibleText(app.wrapper.find('.modal-footer'))).toBe(app.t('close'));
    expect(app.wrapper.find('.label-success').text()).toBe(app.t('compression_started'));
    app.fm.api.asyncSuccess = false;
    await app.wrapper.vm.$nextTick();
    expect(visibleText(app.wrapper.find('.modal-footer'))).toBe(`${app.t('cancel')} ${app.t('compress')}`);
  });

  it('shows the API error in the error bar', async () => {
    mount();
    expect(isHidden(app.wrapper.find('.error-msg.label-danger').element)).toBe(true);
    app.fm.api.error = 'boom';
    await app.wrapper.vm.$nextTick();
    expect(isHidden(app.wrapper.find('.error-msg.label-danger').element)).toBe(false);
    expect(app.wrapper.find('.label-danger span').text()).toBe('boom');
  });
});
