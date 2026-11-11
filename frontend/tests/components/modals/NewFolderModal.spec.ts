import { afterEach, describe, expect, it, vi } from 'vitest';
import NewFolderModal from '../../../src/components/modals/NewFolderModal.vue';
import { diffAgainstRecorded, isHidden, item, recordedContent, mountModal, rendered, select, text, type MountedModal } from './helpers.ts';

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
  it('has the structure of the recorded template', () => {
    app = mountModal(NewFolderModal);
    expect(diffAgainstRecorded(recordedContent('newfolder'), app.wrapper.find('.modal-content').element, app.t, { emptyData: true })).toBeNull();
  });

  it('renders the texts and an empty field on the draft the dialog opens with', async () => {
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

  it('renders an empty field whatever is selected', async () => {
    app = mountModal(NewFolderModal);
    app.fm.prepareNewFolder();
    await select(app.fm, item('a'), item('b'));
    expect((input().element as HTMLInputElement).value).toBe('');
    await select(app.fm);
    expect((input().element as HTMLInputElement).value).toBe('');
  });

  it('writes the trimmed input to the draft and not to the selection', async () => {
    app = mountModal(NewFolderModal);
    const selected = item('a');
    await select(app.fm, selected);
    const draft = app.fm.prepareNewFolder();
    await rendered(app);
    await type('  my folder ');
    expect(draft.tempModel.name).toBe('my folder');
    expect(selected.tempModel.name).toBe('a');
    expect((input().element as HTMLInputElement).value).toBe('  my folder ');
    await type('');
    expect(draft.tempModel.name).toBe('');
  });

  it('shows an empty field again when the dialog is opened anew', async () => {
    app = mountModal(NewFolderModal);
    app.fm.prepareNewFolder();
    await rendered(app);
    await type('abandoned');
    app.fm.prepareNewFolder();
    await rendered(app);
    expect((input().element as HTMLInputElement).value).toBe('');
  });

  it('keeps the typed name and the selection when the creation fails', async () => {
    app = mountModal(NewFolderModal);
    const selected = item('a');
    await select(app.fm, selected);
    app.fm.prepareNewFolder();
    await rendered(app);
    await type('My Folder');
    app.fm.api.error = 'nope';
    await rendered(app);
    expect((input().element as HTMLInputElement).value).toBe('My Folder');
    expect(app.fm.temps).toEqual([selected]);
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
