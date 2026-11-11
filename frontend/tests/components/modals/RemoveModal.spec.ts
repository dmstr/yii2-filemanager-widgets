import { afterEach, describe, expect, it, vi } from 'vitest';
import RemoveModal from '../../../src/components/modals/RemoveModal.vue';
import { diffAgainstLegacy, isHidden, item, legacyContent, mountModal, rendered, select, text, visibleText, type MountedModal } from './helpers.ts';

let app: MountedModal;
afterEach(() => app?.wrapper.unmount());

const cross = () => app.wrapper.find('button.close');
const cancel = () => app.wrapper.find('.modal-footer .btn-default');
const submit = () => app.wrapper.find('button[type=submit]');

describe('RemoveModal', () => {
  it('has the structure of the legacy template', () => {
    app = mountModal(RemoveModal);
    expect(diffAgainstLegacy(legacyContent('remove'), app.wrapper.find('.modal-content').element, app.t, { emptyData: true })).toBeNull();
  });

  it('renders for a single selection', async () => {
    app = mountModal(RemoveModal);
    await select(app.fm, item('a.txt'));
    expect(app.wrapper.find('#remove').classes()).toEqual(expect.arrayContaining(['modal', 'animated', 'fadeIn']));
    expect(text(app.wrapper.find('.modal-title'))).toBe('Confirm');
    expect(visibleText(app.wrapper.find('.modal-body'))).toBe('Are you sure to delete? a.txt');
    expect(text(cancel())).toBe('Cancel');
    expect(text(submit())).toBe('Delete');
    expect(submit().attributes('autofocus')).toBeDefined();
    expect(cross().find('.sr-only').text()).toBe('Close');
  });

  it('renders for several items, an empty selection and a hole in the selection without throwing', async () => {
    app = mountModal(RemoveModal);
    await select(app.fm, item('a'), item('b'));
    expect(visibleText(app.wrapper.find('.modal-body'))).toBe('Are you sure to delete? these 2 elements + Details');
    await select(app.fm);
    expect(visibleText(app.wrapper.find('.modal-body'))).toBe('Are you sure to delete?');
    await expect(select(app.fm, undefined)).resolves.toBeUndefined();
    expect(visibleText(app.wrapper.find('.modal-body'))).toBe('Are you sure to delete?');
  });

  it('refreshes first and closes second on the cross and on Cancel', async () => {
    for (const control of [cross, cancel]) {
      app = mountModal(RemoveModal);
      app.fm.modals.open('remove');
      const calls: string[] = [];
      app.fm.refreshLocation = vi.fn(() => {
        calls.push(`refresh while open=${app.fm.modals.isOpen('remove')}`);
      });
      await control().trigger('click');
      expect(calls).toEqual(['refresh while open=true']);
      expect(app.fm.modals.isOpen('remove')).toBe(false);
      app.wrapper.unmount();
    }
  });

  it('submits through the form, prevents the native submit and does not touch the dialog itself', async () => {
    app = mountModal(RemoveModal);
    app.fm.remove = vi.fn();
    app.fm.refreshLocation = vi.fn();
    app.fm.modals.open('remove');
    const event = new Event('submit', { cancelable: true });
    app.wrapper.find('form').element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(app.fm.remove).toHaveBeenCalledTimes(1);
    await submit().trigger('click');
    expect(app.fm.remove).toHaveBeenCalledTimes(2);
    expect(app.fm.refreshLocation).not.toHaveBeenCalled();
    expect(app.fm.modals.isOpen('remove')).toBe(true);
  });

  it('disables Cancel and Remove, not the cross, while a request runs', async () => {
    app = mountModal(RemoveModal);
    expect(cancel().attributes('disabled')).toBeUndefined();
    app.fm.api.inprocess = true;
    await rendered(app);
    expect(cancel().attributes('disabled')).toBeDefined();
    expect(submit().attributes('disabled')).toBeDefined();
    expect(cross().attributes('disabled')).toBeUndefined();
  });

  it('shows the API error', async () => {
    app = mountModal(RemoveModal);
    const bar = () => app.wrapper.find('.error-msg');
    expect(isHidden(bar().element)).toBe(true);
    app.fm.api.error = 'Nope';
    await rendered(app);
    expect(isHidden(bar().element)).toBe(false);
    expect(text(bar())).toBe('Nope');
  });
});
