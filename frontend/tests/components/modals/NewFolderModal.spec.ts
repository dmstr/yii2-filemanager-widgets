import { afterEach, describe, expect, it, vi } from 'vitest';
import NewFolderModal from '../../../src/components/modals/NewFolderModal.vue';
import { diffAgainstLegacy, isHidden, item, legacyContent, mountModal, rendered, select, text, type MountedModal } from './helpers.ts';

let app: MountedModal;
afterEach(() => app?.wrapper.unmount());

const input = () => app.wrapper.find('input.form-control');
const cancel = () => app.wrapper.find('.modal-footer .btn-default');
const submit = () => app.wrapper.find('button[type=submit]');
const cross = () => app.wrapper.find('button.close');
const type = async (value: string) => {
  (input().element as HTMLInputElement).value = value;
  await input().trigger('input');
};

describe('NewFolderModal', () => {
  it('has the structure of the legacy template', () => {
    app = mountModal(NewFolderModal);
    expect(diffAgainstLegacy(legacyContent('newfolder'), app.wrapper.find('.modal-content').element, app.t, { emptyData: true })).toBeNull();
  });

  it('renders the texts and an empty field on the phantom item the dialog opens with', async () => {
    app = mountModal(NewFolderModal);
    app.fm.prepareNewFolder();
    await rendered(app);
    expect(text(app.wrapper.find('.modal-title'))).toBe('New folder');
    expect(text(app.wrapper.find('label.radio'))).toBe('Folder name');
    expect((input().element as HTMLInputElement).value).toBe('');
    expect(input().attributes('autofocus')).toBeDefined();
    expect(text(cancel())).toBe('Cancel');
    expect(text(submit())).toBe('Create');
  });

  it('renders for several items and for no selection without throwing', async () => {
    app = mountModal(NewFolderModal);
    await select(app.fm, item('a'), item('b'));
    expect((input().element as HTMLInputElement).value).toBe('');
    await select(app.fm);
    await select(app.fm, undefined);
    expect((input().element as HTMLInputElement).value).toBe('');
  });

  it('writes the trimmed input to the tempModel of the selected item', async () => {
    app = mountModal(NewFolderModal);
    const phantom = app.fm.prepareNewFolder();
    await rendered(app);
    await type('  my folder ');
    expect(phantom.tempModel.name).toBe('my folder');
    expect((input().element as HTMLInputElement).value).toBe('  my folder ');
    await type('');
    expect(phantom.tempModel.name).toBe('');
  });

  it('ignores typing without a single selection', async () => {
    app = mountModal(NewFolderModal);
    await select(app.fm);
    await expect(type('x')).resolves.toBeUndefined();
  });

  it('cross and Cancel only close, without a refresh', async () => {
    for (const control of [cross, cancel]) {
      app = mountModal(NewFolderModal);
      app.fm.modals.open('newfolder');
      app.fm.refreshLocation = vi.fn();
      await control().trigger('click');
      expect(app.fm.modals.isOpen('newfolder')).toBe(false);
      expect(app.fm.refreshLocation).not.toHaveBeenCalled();
      app.wrapper.unmount();
    }
  });

  it('submits through the form and calls createFolder', async () => {
    app = mountModal(NewFolderModal);
    app.fm.createFolder = vi.fn();
    const event = new Event('submit', { cancelable: true });
    app.wrapper.find('form').element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await submit().trigger('click');
    expect(app.fm.createFolder).toHaveBeenCalledTimes(2);
  });

  it('disables Cancel and Create while a request runs, and shows the error', async () => {
    app = mountModal(NewFolderModal);
    app.fm.api.inprocess = true;
    app.fm.api.error = 'Invalid name';
    await rendered(app);
    expect(cancel().attributes('disabled')).toBeDefined();
    expect(submit().attributes('disabled')).toBeDefined();
    expect(cross().attributes('disabled')).toBeUndefined();
    expect(isHidden(app.wrapper.find('.error-msg').element)).toBe(false);
    expect(text(app.wrapper.find('.error-msg'))).toBe('Invalid name');
  });
});
