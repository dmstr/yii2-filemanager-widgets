import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DownloadLinkModal from '../../../src/components/modals/DownloadLinkModal.vue';
import { copyToClipboard } from '../../../src/components/modals/copyToClipboard.ts';
import { diffAgainstLegacy, isHidden, item, legacyAvailable, legacyContent, mountModal, select, text, type MountedModal } from './helpersB.ts';

vi.mock('../../../src/components/modals/copyToClipboard.ts', () => ({ copyToClipboard: vi.fn(() => Promise.resolve(true)) }));

let app: MountedModal;
beforeEach(() => vi.mocked(copyToClipboard).mockClear());
afterEach(() => app?.wrapper.unmount());

const nextTick = () => app.wrapper.vm.$nextTick();
const inputs = () => app.wrapper.findAll('input.form-control');
const copyButtons = () => app.wrapper.findAll('.input-group-btn button');
const lastCopied = () => {
  const calls = vi.mocked(copyToClipboard).mock.calls;
  return calls[calls.length - 1][0];
};
const labels = () => app.wrapper.findAll('.modal-body label.radio').map((l) => l.text());

/** Puts the dialog state in the shape `downloadLink()` leaves it in. */
function showDefault(): void {
  app.fm.path = '/sub/a.txt';
  app.fm.streamLink = '/api/handler?action=stream&path=%2Fsub%2Fa.txt';
  app.fm.dlLink = 'http://localhost/api/handler?action=download&path=%2Fsub%2Fa.txt';
  app.fm.urls = [];
  app.fm.showDefaultUrls = true;
  app.fm.showCustomUrls = false;
}

function showCustom(urls: Record<string, string>): void {
  app.fm.path = '/sub/a.txt';
  app.fm.urls = urls;
  app.fm.showDefaultUrls = false;
  app.fm.showCustomUrls = true;
}

describe('DownloadLinkModal', () => {
  it.runIf(legacyAvailable)('has the structure of the legacy template, default URL branch', async () => {
    app = mountModal(DownloadLinkModal);
    showDefault();
    await nextTick();
    const legacy = legacyContent('downloadlink', ['[ng-if="showCustomUrls"]']);
    expect(diffAgainstLegacy(legacy, app.wrapper.find('.modal-content').element, app.t)).toBeNull();
  });

  it.runIf(legacyAvailable)('has the structure of the legacy template, custom URL branch', async () => {
    app = mountModal(DownloadLinkModal);
    showCustom({ image: 'http://x/i.png', thumb: 'http://x/t.png' });
    await nextTick();
    const legacy = legacyContent('downloadlink', ['[ng-if="showDefaultUrls"]']);
    // The default-URL wrapper is an ng-if in legacy, so the path field is followed by the repeat rows only.
    expect(diffAgainstLegacy(legacy, app.wrapper.find('.modal-content').element, app.t)).toBeNull();
  });

  it('renders the three default fields with their values and ids', async () => {
    app = mountModal(DownloadLinkModal);
    showDefault();
    await nextTick();
    expect(app.wrapper.find('#downloadlink').classes()).toEqual(expect.arrayContaining(['modal', 'animated', 'fadeIn']));
    expect(text(app.wrapper.find('.modal-title'))).toBe(app.t('copy_links'));
    expect(labels()).toEqual([app.t('file_path'), app.t('stream_link'), app.t('download_link')]);
    expect(inputs().map((i) => [i.attributes('id'), (i.element as HTMLInputElement).value])).toEqual([
      ['afm-path-link', '/sub/a.txt'],
      ['afm-stream-link', '/api/handler?action=stream&path=%2Fsub%2Fa.txt'],
      ['afm-download-link', 'http://localhost/api/handler?action=download&path=%2Fsub%2Fa.txt'],
    ]);
    expect(inputs()[2].attributes('autofocus')).toBeDefined();
    expect(copyButtons()).toHaveLength(3);
    expect(copyButtons()[0].find('i').classes()).toEqual(['glyphicon', 'glyphicon-copy']);
  });

  it('shows only the path field when neither branch is active, and renders before any selection', async () => {
    app = mountModal(DownloadLinkModal);
    await nextTick();
    expect(inputs().map((i) => i.attributes('id'))).toEqual(['afm-path-link']);
    expect((inputs()[0].element as HTMLInputElement).value).toBe('');
    app.fm.showCustomUrls = true;
    app.fm.urls = [];
    await nextTick();
    expect(inputs()).toHaveLength(1);
  });

  it('shows one field per custom URL with the translated key as label and a field-specific id (Q-04)', async () => {
    app = mountModal(DownloadLinkModal);
    showCustom({ image: 'http://x/i.png', download: 'http://x/d.bin', my_custom: 'http://x/c' });
    await nextTick();
    expect(labels()).toEqual([app.t('file_path'), app.t('image'), app.t('download'), 'my_custom']);
    expect(inputs().map((i) => [i.attributes('id'), (i.element as HTMLInputElement).value])).toEqual([
      ['afm-path-link', '/sub/a.txt'],
      ['afm-image-link', 'http://x/i.png'],
      ['afm-download-link', 'http://x/d.bin'],
      ['afm-my_custom-link', 'http://x/c'],
    ]);
    expect(inputs().slice(1).every((i) => i.attributes('autofocus') !== undefined)).toBe(true);
    expect(labels().includes(app.t('stream_link'))).toBe(false);
  });

  it('copies the field next to the clicked button, in the default and in the custom branch (Q-04)', async () => {
    app = mountModal(DownloadLinkModal);
    showDefault();
    await nextTick();
    for (const [i, button] of copyButtons().entries()) {
      await button.trigger('click');
      expect(lastCopied()).toBe(inputs()[i].element);
    }
    showCustom({ image: 'http://x/i.png', thumb: 'http://x/t.png' });
    await nextTick();
    expect(copyButtons()).toHaveLength(3);
    for (const [i, button] of copyButtons().entries()) {
      await button.trigger('click');
      expect(lastCopied()).toBe(inputs()[i].element);
    }
    expect(vi.mocked(copyToClipboard).mock.calls.map(([el]) => (el as HTMLElement).id).slice(-3)).toEqual(['afm-path-link', 'afm-image-link', 'afm-thumb-link']);
  });

  it('copies before the form submit that follows the click re-runs downloadLink()', async () => {
    app = mountModal(DownloadLinkModal);
    showDefault();
    const order: string[] = [];
    app.fm.downloadLink = vi.fn(() => order.push('downloadLink'));
    vi.mocked(copyToClipboard).mockImplementationOnce(() => (order.push('copy'), Promise.resolve(true)));
    await nextTick();
    await copyButtons()[0].trigger('click');
    expect(order).toEqual(['copy', 'downloadLink']);
  });

  it('clears the dialog error when a copy button is clicked, as the legacy re-submit did', async () => {
    app = mountModal(DownloadLinkModal);
    const a = item('a.txt');
    await select(app.fm, a);
    app.fm.downloadLink();
    app.fm.api.error = 'old';
    await nextTick();
    expect(app.wrapper.find('.modal-body .label-danger').exists()).toBe(false);
    await copyButtons()[0].trigger('click');
    expect(app.fm.api.error).toBe('');
    expect((inputs()[0].element as HTMLInputElement).value).toBe('/sub/a.txt');
  });

  it('closes on the cross and on Cancel, and prevents the native submit', async () => {
    for (const control of [() => app.wrapper.find('button.close'), () => app.wrapper.find('.modal-footer button')]) {
      app = mountModal(DownloadLinkModal);
      app.fm.modals.open('downloadlink');
      await control().trigger('click');
      expect(app.fm.modals.isOpen('downloadlink')).toBe(false);
      app.wrapper.unmount();
    }
    app = mountModal(DownloadLinkModal);
    app.fm.downloadLink = vi.fn();
    const event = new Event('submit', { cancelable: true });
    app.wrapper.find('form').element.dispatchEvent(event);
    expect(app.fm.downloadLink).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('has a footer with the Cancel button only, never disabled', async () => {
    app = mountModal(DownloadLinkModal);
    app.fm.api.inprocess = true;
    await nextTick();
    const buttons = app.wrapper.findAll('.modal-footer button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].text()).toBe(app.t('cancel'));
    expect(buttons[0].attributes('disabled')).toBeUndefined();
  });

  it('has no error bar, as in legacy', () => {
    app = mountModal(DownloadLinkModal);
    expect(app.wrapper.find('.label-danger').exists()).toBe(false);
    expect(isHidden(app.wrapper.find('.modal-body').element)).toBe(false);
  });
});
