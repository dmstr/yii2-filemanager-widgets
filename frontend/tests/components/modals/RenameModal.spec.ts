import { afterEach, describe, expect, it, vi } from 'vitest';
import RenameModal from '../../../src/components/modals/RenameModal.vue';
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

describe('RenameModal', () => {
  it('has the structure of the recorded template', async () => {
    app = mountModal(RenameModal);
    // The helper empties the template expressions; a selection of one hole renders the name empty as well.
    app.fm.temps = [undefined];
    await rendered(app);
    expect(diffAgainstRecorded(recordedContent('rename'), app.wrapper.find('.modal-content').element, app.t, { emptyData: true })).toBeNull();
  });

  it('shows the old name and the editable name for a single selection', async () => {
    app = mountModal(RenameModal);
    await select(app.fm, item('a.txt'));
    expect(text(app.wrapper.find('.modal-title'))).toBe('Rename');
    expect(text(app.wrapper.find('label.radio'))).toBe('Enter new name for a.txt');
    expect((input().element as HTMLInputElement).value).toBe('a.txt');
    expect(input().attributes('autofocus')).toBeDefined();
    expect(text(cancel())).toBe('Cancel');
    expect(text(submit())).toBe('Rename');
  });

  it('prints "false" as the name and an empty input for several items and for no selection, nothing for a hole', async () => {
    app = mountModal(RenameModal);
    await select(app.fm, item('a'), item('b'));
    expect(text(app.wrapper.find('label.radio b'))).toBe('false');
    expect((input().element as HTMLInputElement).value).toBe('');
    await select(app.fm);
    expect(text(app.wrapper.find('label.radio'))).toBe('Enter new name for false');
    await select(app.fm, undefined);
    expect(text(app.wrapper.find('label.radio b'))).toBe('');
  });

  it('writes the trimmed input to tempModel, an empty field as an empty string', async () => {
    app = mountModal(RenameModal);
    const a = item('a.txt');
    await select(app.fm, a);
    await type('  new name  ');
    expect(a.tempModel.name).toBe('new name');
    expect((input().element as HTMLInputElement).value).toBe('  new name  ');
    expect(a.model.name).toBe('a.txt');
    await type('');
    expect(a.tempModel.name).toBe('');
    await type('   ');
    expect(a.tempModel.name).toBe('');
  });

  it('ignores typing without a single selection', async () => {
    app = mountModal(RenameModal);
    const a = item('a');
    await select(app.fm, a, item('b'));
    await expect(type('x')).resolves.toBeUndefined();
    expect(a.tempModel.name).toBe('a');
    expect((input().element as HTMLInputElement).value).toBe('');
  });

  it('follows changes of tempModel made elsewhere', async () => {
    app = mountModal(RenameModal);
    const a = item('a.txt');
    await select(app.fm, a);
    a.tempModel.name = 'other';
    await rendered(app);
    expect((input().element as HTMLInputElement).value).toBe('other');
  });

  it('cross and Cancel only close, without a refresh', async () => {
    for (const control of [cross, cancel]) {
      app = mountModal(RenameModal);
      app.fm.modals.open('rename');
      app.fm.refreshLocation = vi.fn();
      app.fm.rename = vi.fn();
      await control().trigger('click');
      expect(app.fm.modals.isOpen('rename')).toBe(false);
      expect(app.fm.refreshLocation).not.toHaveBeenCalled();
      expect(app.fm.rename).not.toHaveBeenCalled();
      app.wrapper.unmount();
    }
  });

  it('submits through the form, natively prevented, and from the button', async () => {
    app = mountModal(RenameModal);
    app.fm.rename = vi.fn();
    const event = new Event('submit', { cancelable: true });
    app.wrapper.find('form').element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await submit().trigger('click');
    expect(app.fm.rename).toHaveBeenCalledTimes(2);
  });

  it('disables Cancel and Rename while a request runs, and shows the error', async () => {
    app = mountModal(RenameModal);
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
