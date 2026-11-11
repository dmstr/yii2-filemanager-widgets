import { afterEach, describe, expect, it, vi } from 'vitest';
import EditModal from '../../../src/components/modals/EditModal.vue';
import { diffAgainstLegacy, isHidden, item, legacyContent, mountModal, select, text, type MountedModal } from './helpers.ts';

let app: MountedModal;
afterEach(() => app?.wrapper.unmount());

const mount = (edit = true) =>
  (app = mountModal(EditModal, (config) => {
    config.allowedActions.edit = edit;
  }));
const textarea = () => app.wrapper.find('textarea');
const cross = () => app.wrapper.find('button.close:not(.fullscreen)');
const toggle = () => app.wrapper.find('button.close.fullscreen');
const footerButtons = () => app.wrapper.findAll('.modal-footer button');
const nextTick = () => app.wrapper.vm.$nextTick();

describe('EditModal', () => {
  it('has the structure of the legacy template', () => {
    mount();
    expect(diffAgainstLegacy(legacyContent('edit'), app.wrapper.find('.modal-content').element, app.t)).toBeNull();
  });

  it('is the large dialog', () => {
    mount();
    expect(app.wrapper.find('#edit .modal-dialog').classes()).toContain('modal-lg');
  });

  it('renders the full path as heading and the content for a single selection', async () => {
    mount();
    const a = item('a.txt');
    a.tempModel.content = 'hello';
    await select(app.fm, a);
    expect(text(app.wrapper.find('label.radio.bold'))).toBe('/sub/a.txt');
    expect(text(app.wrapper.find('.modal-title'))).toBe(app.t('edit_file'));
    expect(textarea().element.value).toBe('hello');
    expect(textarea().attributes('autofocus')).toBeDefined();
  });

  it('renders an empty heading and field for several items, an empty selection and a hole', async () => {
    mount();
    for (const selection of [[item('a'), item('b')], [], [undefined]]) {
      await select(app.fm, ...selection);
      expect(text(app.wrapper.find('label.radio.bold'))).toBe('');
      expect(textarea().element.value).toBe('');
    }
  });

  it('hides the textarea and shows the loading label while a request runs', async () => {
    mount();
    expect(isHidden(textarea().element)).toBe(false);
    expect(isHidden(app.wrapper.find('.label-warning').element)).toBe(true);
    app.fm.api.inprocess = true;
    await nextTick();
    expect(isHidden(textarea().element)).toBe(true);
    expect(isHidden(app.wrapper.find('.label-warning').element)).toBe(false);
    expect(text(app.wrapper.find('.label-warning'))).toBe(`${app.t('loading')} ...`);
  });

  it('writes the typed content to tempModel.content, trimmed like ng-model on a textarea', async () => {
    mount();
    const a = item('a.txt');
    await select(app.fm, a);
    await textarea().setValue('  line one\nline two\n\n');
    expect(a.tempModel.content).toBe('line one\nline two');
    expect((textarea().element as HTMLTextAreaElement).value).toBe('  line one\nline two\n\n');
    await select(app.fm);
    await expect(textarea().setValue('x')).resolves.toBeUndefined();
    expect((textarea().element as HTMLTextAreaElement).value).toBe('');
  });

  it('toggles modal-fullscreen on the dialog with the second header button', async () => {
    mount();
    const modal = app.wrapper.find('#edit');
    expect(modal.classes()).not.toContain('modal-fullscreen');
    await toggle().trigger('click');
    expect(modal.classes()).toContain('modal-fullscreen');
    expect(modal.classes()).toEqual(expect.arrayContaining(['modal', 'animated', 'fadeIn']));
    await toggle().trigger('click');
    expect(modal.classes()).not.toContain('modal-fullscreen');
  });

  it('closes on the cross and on Close', async () => {
    for (const control of [cross, () => footerButtons()[0]]) {
      mount();
      app.fm.modals.open('edit');
      await control().trigger('click');
      expect(app.fm.modals.isOpen('edit')).toBe(false);
      app.wrapper.unmount();
    }
  });

  it('shows the save button only with allowedActions.edit', () => {
    mount(true);
    expect(isHidden(app.wrapper.find('button[type=submit]').element)).toBe(false);
    app.wrapper.unmount();
    mount(false);
    expect(isHidden(app.wrapper.find('button[type=submit]').element)).toBe(true);
  });

  it('submits through the form and prevents the native submit', async () => {
    mount();
    app.fm.edit = vi.fn();
    const event = new Event('submit', { cancelable: true });
    app.wrapper.find('form').element.dispatchEvent(event);
    expect(app.fm.edit).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    await app.wrapper.find('button[type=submit]').trigger('click');
    expect(app.fm.edit).toHaveBeenCalledTimes(2);
  });

  it('disables Close and Save while a request runs, not the cross buttons', async () => {
    mount();
    app.fm.api.inprocess = true;
    await nextTick();
    expect(footerButtons().every((b) => b.attributes('disabled') !== undefined)).toBe(true);
    expect(cross().attributes('disabled')).toBeUndefined();
    expect(toggle().attributes('disabled')).toBeUndefined();
  });

  it('shows the API error in the error bar', async () => {
    mount();
    expect(isHidden(app.wrapper.find('.label-danger').element)).toBe(true);
    app.fm.api.error = 'boom';
    await nextTick();
    expect(isHidden(app.wrapper.find('.label-danger').element)).toBe(false);
    expect(app.wrapper.find('.label-danger span').text()).toBe('boom');
  });
});
