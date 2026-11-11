import { afterEach, describe, expect, it, vi } from 'vitest';
import MoveModal from '../../../src/components/modals/MoveModal.vue';
import { diffAgainstRecorded, isHidden, item, recordedContent, mountModal, rendered, select, text, visibleText, type MountedModal } from './helpers.ts';

let app: MountedModal;
afterEach(() => app?.wrapper.unmount());

const cross = () => app.wrapper.find('button.close');
const submit = () => app.wrapper.find('button[type=submit]');

describe('MoveModal', () => {
  it('has the structure of the recorded template', () => {
    app = mountModal(MoveModal);
    expect(diffAgainstRecorded(recordedContent('move'), app.wrapper.find('.modal-content').element, app.t, { emptyData: true })).toBeNull();
  });

  it('renders the path selector for single, multiple and empty selections', async () => {
    app = mountModal(MoveModal);
    await select(app.fm, item('a.txt'));
    expect(text(app.wrapper.find('.modal-title'))).toBe('Move');
    expect(visibleText(app.wrapper.find('.panel'))).toContain('a.txt');
    expect(text(submit())).toBe('Move');
    await select(app.fm, item('a'), item('b'));
    expect(visibleText(app.wrapper.find('.panel'))).toContain('these 2 elements');
    await expect(select(app.fm)).resolves.toBeUndefined();
    expect(visibleText(app.wrapper.find('.panel'))).toContain('Selection:');
  });

  it('refreshes first and closes second on the cross and on Cancel', async () => {
    for (const control of [cross, () => app.wrapper.find('form > .modal-footer .btn-default')]) {
      app = mountModal(MoveModal);
      app.fm.modals.open('move');
      const calls: string[] = [];
      app.fm.refreshLocation = vi.fn(() => {
        calls.push(`refresh while open=${app.fm.modals.isOpen('move')}`);
      });
      await control().trigger('click');
      expect(calls).toEqual(['refresh while open=true']);
      expect(app.fm.modals.isOpen('move')).toBe(false);
      app.wrapper.unmount();
    }
  });

  it('has no second footer or close button inside the selector panel', () => {
    app = mountModal(MoveModal);
    expect(app.wrapper.find('.panel .modal-footer').exists()).toBe(false);
    expect(app.wrapper.find('.panel button').exists()).toBe(false);
  });

  it('submits through the form and calls move', async () => {
    app = mountModal(MoveModal);
    app.fm.move = vi.fn();
    const event = new Event('submit', { cancelable: true });
    app.wrapper.find('form').element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(app.fm.move).toHaveBeenCalledTimes(1);
    await submit().trigger('click');
    expect(app.fm.move).toHaveBeenCalledTimes(2);
  });

  it('disables all buttons but the cross while a request runs', async () => {
    app = mountModal(MoveModal);
    app.fm.api.inprocess = true;
    await rendered(app);
    const disabled = app.wrapper.findAll('button').filter((b) => b.attributes('disabled') !== undefined);
    expect(disabled.length).toBe(3); // selector close, Cancel, Move
    expect(cross().attributes('disabled')).toBeUndefined();
  });

  it('shows the API error', async () => {
    app = mountModal(MoveModal);
    app.fm.api.error = 'Same path';
    await rendered(app);
    const bar = app.wrapper.find('.error-msg');
    expect(isHidden(bar.element)).toBe(false);
    expect(text(bar)).toBe('Same path');
  });
});
