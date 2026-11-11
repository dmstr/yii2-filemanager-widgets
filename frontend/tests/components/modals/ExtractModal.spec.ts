import { afterEach, describe, expect, it, vi } from 'vitest';
import ExtractModal from '../../../src/components/modals/ExtractModal.vue';
import { diffAgainstRecorded, isHidden, item, recordedContent, mountModal, select, text, visibleText, type MountedModal } from './helpers.ts';

let app: MountedModal;
afterEach(() => app?.wrapper.unmount());

const body = () => app.wrapper.find('.modal-body');
const input = () => app.wrapper.find('input.form-control');
const cross = () => app.wrapper.find('button.close');
const footerButtons = () => app.wrapper.findAll('.modal-footer button');
const cancel = () => footerButtons()[1];
const submit = () => app.wrapper.find('button[type=submit]');
const nextTick = () => app.wrapper.vm.$nextTick();

describe('ExtractModal', () => {
  it('has the structure of the recorded template', () => {
    app = mountModal(ExtractModal);
    expect(diffAgainstRecorded(recordedContent('extract'), app.wrapper.find('.modal-content').element, app.t)).toBeNull();
  });

  it('renders for a single selection', async () => {
    app = mountModal(ExtractModal);
    await select(app.fm, item('a.zip'));
    expect(app.wrapper.find('#extract').classes()).toEqual(expect.arrayContaining(['modal', 'animated', 'fadeIn']));
    expect(text(app.wrapper.find('.modal-title'))).toBe(app.t('extract_item'));
    expect(visibleText(body())).toBe(`${app.t('enter_folder_name_for_extraction')} a.zip`);
    expect(input().attributes('autofocus')).toBeDefined();
    expect(visibleText(app.wrapper.find('.modal-footer'))).toBe(`${app.t('cancel')} ${app.t('extract')}`);
  });

  it('renders an empty name for several items, an empty selection and a hole without throwing', async () => {
    app = mountModal(ExtractModal);
    await select(app.fm, item('a'), item('b'));
    expect(visibleText(body())).toBe(app.t('enter_folder_name_for_extraction'));
    await select(app.fm);
    expect(visibleText(body())).toBe(app.t('enter_folder_name_for_extraction'));
    await select(app.fm, undefined);
    expect(visibleText(body())).toBe(app.t('enter_folder_name_for_extraction'));
    expect((input().element as HTMLInputElement).value).toBe('');
  });

  it('shows the temp name of the item and writes the trimmed input back', async () => {
    app = mountModal(ExtractModal);
    const a = item('a.zip');
    a.tempModel.name = 'start';
    await select(app.fm, a);
    expect((input().element as HTMLInputElement).value).toBe('start');
    await input().setValue('  target dir  ');
    expect(a.tempModel.name).toBe('target dir');
    expect((input().element as HTMLInputElement).value).toBe('  target dir  ');
    await input().setValue('');
    expect(a.tempModel.name).toBe('');
  });

  it('keeps the typed text without writing it when nothing is selected', async () => {
    app = mountModal(ExtractModal);
    await select(app.fm);
    await expect(input().setValue('x')).resolves.toBeUndefined();
    expect(app.fm.singleSelection()).toBeUndefined();
    expect((input().element as HTMLInputElement).value).toBe('x');
  });

  it('closes on the cross and on Cancel without refreshing', async () => {
    for (const control of [cross, cancel]) {
      app = mountModal(ExtractModal);
      app.fm.refreshLocation = vi.fn();
      app.fm.modals.open('extract');
      await control().trigger('click');
      expect(app.fm.modals.isOpen('extract')).toBe(false);
      expect(app.fm.refreshLocation).not.toHaveBeenCalled();
      app.wrapper.unmount();
    }
  });

  it('submits through the form and prevents the native submit', async () => {
    app = mountModal(ExtractModal);
    app.fm.extract = vi.fn();
    const event = new Event('submit', { cancelable: true });
    app.wrapper.find('form').element.dispatchEvent(event);
    expect(app.fm.extract).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    await submit().trigger('click');
    expect(app.fm.extract).toHaveBeenCalledTimes(2);
  });

  it('disables the footer buttons while a request runs', async () => {
    app = mountModal(ExtractModal);
    app.fm.api.inprocess = true;
    await nextTick();
    expect(footerButtons().filter((b) => b.attributes('disabled') !== undefined)).toHaveLength(3);
    app.fm.api.inprocess = false;
    await nextTick();
    expect(footerButtons().every((b) => b.attributes('disabled') === undefined)).toBe(true);
  });

  it('swaps body and footer after an async success', async () => {
    app = mountModal(ExtractModal);
    await select(app.fm, item('a.zip'));
    app.fm.api.asyncSuccess = true;
    await nextTick();
    expect(visibleText(body())).toBe(app.t('extraction_started'));
    expect(visibleText(app.wrapper.find('.modal-footer'))).toBe(app.t('close'));
    app.fm.api.asyncSuccess = false;
    await nextTick();
    expect(visibleText(app.wrapper.find('.modal-footer'))).toBe(`${app.t('cancel')} ${app.t('extract')}`);
  });

  it('shows the API error in the error bar', async () => {
    app = mountModal(ExtractModal);
    expect(isHidden(app.wrapper.find('.label-danger').element)).toBe(true);
    app.fm.api.error = 'boom';
    await nextTick();
    expect(isHidden(app.wrapper.find('.label-danger').element)).toBe(false);
    expect(app.wrapper.find('.label-danger span').text()).toBe('boom');
  });
});
