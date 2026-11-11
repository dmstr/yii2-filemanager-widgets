import { afterEach, describe, expect, it, vi } from 'vitest';
import CopyModal from '../../../src/components/modals/CopyModal.vue';
import { diffAgainstRecorded, isHidden, item, recordedContent, mountModal, rendered, select, text, visibleText, type MountedModal } from './helpers.ts';

let app: MountedModal;
afterEach(() => app?.wrapper.unmount());

const nameBlock = () => app.wrapper.find('.modal-body > div');
const input = () => app.wrapper.find('input.form-control');
const footerButtons = () => app.wrapper.findAll('form > .modal-footer button');
const cancel = () => footerButtons()[0];
const submit = () => app.wrapper.find('button[type=submit]');
const cross = () => app.wrapper.find('button.close');
const selectorClose = () => app.wrapper.find('.panel .modal-footer .btn-default');
const type = async (value: string) => {
  (input().element as HTMLInputElement).value = value;
  await input().trigger('input');
};

describe('CopyModal', () => {
  it('has the structure of the recorded template', () => {
    app = mountModal(CopyModal);
    expect(diffAgainstRecorded(recordedContent('copy'), app.wrapper.find('.modal-content').element, app.t, { emptyData: true })).toBeNull();
  });

  it('shows the name field for a single selection', async () => {
    app = mountModal(CopyModal);
    await select(app.fm, item('a.txt'));
    expect(text(app.wrapper.find('.modal-title'))).toBe('Copy file');
    expect(isHidden(nameBlock().element)).toBe(false);
    expect(text(nameBlock().find('label'))).toBe('Enter new name for a.txt');
    expect((input().element as HTMLInputElement).value).toBe('a.txt');
    expect(input().attributes('autofocus')).toBeDefined();
    expect(visibleText(app.wrapper.find('.panel'))).toContain('a.txt');
    expect(text(submit())).toBe('Copy');
  });

  it('hides the name field, but keeps it mounted, for several items and for no selection', async () => {
    app = mountModal(CopyModal);
    await select(app.fm, item('a'), item('b'));
    expect(nameBlock().exists()).toBe(true);
    expect(isHidden(nameBlock().element)).toBe(true);
    expect(visibleText(app.wrapper.find('.panel'))).toContain('these 2 elements');
    await select(app.fm);
    expect(isHidden(nameBlock().element)).toBe(true);
    expect(text(nameBlock().find('b'))).toBe('');
    await select(app.fm, undefined);
    expect(isHidden(nameBlock().element)).toBe(true);
  });

  it('writes the trimmed input to tempModel', async () => {
    app = mountModal(CopyModal);
    const a = item('a.txt');
    await select(app.fm, a);
    await type(' copy.txt ');
    expect(a.tempModel.name).toBe('copy.txt');
    expect((input().element as HTMLInputElement).value).toBe(' copy.txt ');
    await type('');
    expect(a.tempModel.name).toBe('');
  });

  it('cross, Cancel and the selector close button only close, without a refresh', async () => {
    for (const control of [cross, cancel, selectorClose]) {
      app = mountModal(CopyModal);
      app.fm.modals.open('copy');
      app.fm.refreshLocation = vi.fn();
      await control().trigger('click');
      expect(app.fm.modals.isOpen('copy')).toBe(false);
      expect(app.fm.refreshLocation).not.toHaveBeenCalled();
      app.wrapper.unmount();
    }
  });

  it('submits through the form and calls copy', async () => {
    app = mountModal(CopyModal);
    app.fm.copy = vi.fn();
    const event = new Event('submit', { cancelable: true });
    app.wrapper.find('form').element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await submit().trigger('click');
    expect(app.fm.copy).toHaveBeenCalledTimes(2);
  });

  it('disables Cancel, Copy and the selector close button while a request runs, and shows the error', async () => {
    app = mountModal(CopyModal);
    app.fm.api.inprocess = true;
    app.fm.api.error = 'Invalid name';
    await rendered(app);
    for (const b of [cancel(), submit(), selectorClose()]) {
      expect(b.attributes('disabled')).toBeDefined();
    }
    expect(cross().attributes('disabled')).toBeUndefined();
    expect(text(app.wrapper.find('.error-msg'))).toBe('Invalid name');
  });
});
