import { afterEach, describe, expect, it, vi } from 'vitest';
import ImagePreviewModal from '../../../src/components/modals/ImagePreviewModal.vue';
import { diffAgainstLegacy, isHidden, item, legacyContent, mountModal, rendered, select, text, type MountedModal } from './helpers.ts';

let app: MountedModal;
afterEach(() => app?.wrapper.unmount());

const img = () => app.wrapper.find('#imagepreview-target');
const label = () => app.wrapper.find('.label-warning');
const footerClose = () => app.wrapper.find('.modal-footer .btn-default');
const cross = () => app.wrapper.find('button.close');

describe('ImagePreviewModal', () => {
  it('has the structure of the legacy template', () => {
    app = mountModal(ImagePreviewModal);
    expect(diffAgainstLegacy(legacyContent('imagepreview'), app.wrapper.find('.modal-content').element, app.t, { emptyData: true })).toBeNull();
  });

  it('renders title, alt and the close buttons for a single selection', async () => {
    app = mountModal(ImagePreviewModal);
    await select(app.fm, item('photo.png'));
    expect(text(app.wrapper.find('.modal-title'))).toBe('Item preview');
    expect(img().attributes('alt')).toBe('photo.png');
    expect(img().classes()).toContain('preview');
    expect(text(footerClose())).toBe('Close');
    expect(cross().find('.sr-only').text()).toBe('Close');
  });

  it('renders an empty alt for several items, no selection and a hole', async () => {
    app = mountModal(ImagePreviewModal);
    await select(app.fm, item('a'), item('b'));
    expect(img().attributes('alt')).toBe('');
    await select(app.fm);
    expect(img().attributes('alt')).toBe('');
    await select(app.fm, undefined);
    expect(img().attributes('alt')).toBe('');
  });

  it('has no src before the first preview and binds previewUrl afterwards', async () => {
    app = mountModal(ImagePreviewModal);
    expect(img().attributes('src')).toBeUndefined();
    app.fm.previewUrl = '/p/photo.png';
    await rendered(app);
    expect(img().attributes('src')).toBe('/p/photo.png');
  });

  it('shows the loading label, the loading class and the disabled close button while in process', async () => {
    app = mountModal(ImagePreviewModal);
    expect(isHidden(label().element)).toBe(true);
    expect(img().classes()).not.toContain('loading');
    expect(footerClose().attributes('disabled')).toBeUndefined();
    app.fm.api.inprocess = true;
    await rendered(app);
    expect(isHidden(label().element)).toBe(false);
    expect(text(label())).toBe('Loading ...');
    expect(img().classes()).toContain('loading');
    expect(footerClose().attributes('disabled')).toBeDefined();
    expect(cross().attributes('disabled')).toBeUndefined();
  });

  it('clears the loading state on the load and on the error event of the image', async () => {
    for (const event of ['load', 'error']) {
      app = mountModal(ImagePreviewModal);
      app.fm.api.inprocess = true;
      await img().trigger(event);
      expect(app.fm.api.inprocess).toBe(false);
      app.wrapper.unmount();
    }
  });

  it('opens through the state: openImagePreview sets the url and the loading flag', async () => {
    app = mountModal(ImagePreviewModal);
    const photo = item('photo.png');
    await select(app.fm, photo);
    app.fm.openImagePreview();
    await rendered(app);
    expect(app.fm.modals.isOpen('imagepreview')).toBe(true);
    expect(img().attributes('src')).toBe(app.fm.previewUrl);
    expect(img().attributes('src')).toBeTruthy();
    expect(img().classes()).toContain('loading');
  });

  it('closes with the cross and the button, without a refresh', async () => {
    for (const control of [cross, footerClose]) {
      app = mountModal(ImagePreviewModal);
      app.fm.modals.open('imagepreview');
      app.fm.refreshLocation = vi.fn();
      await control().trigger('click');
      expect(app.fm.modals.isOpen('imagepreview')).toBe(false);
      expect(app.fm.refreshLocation).not.toHaveBeenCalled();
      app.wrapper.unmount();
    }
  });

  it('shows the API error', async () => {
    app = mountModal(ImagePreviewModal);
    app.fm.api.error = 'Broken';
    await rendered(app);
    expect(text(app.wrapper.find('.error-msg'))).toBe('Broken');
  });

  describe('reopening over an image that is already loaded', () => {
    /** A browser fires `load` for an unchanged `src` only when the attribute is set again. */
    const reopen = async (complete: boolean, inprocess = true) => {
      app = mountModal(ImagePreviewModal);
      app.fm.previewUrl = '/p/photo.png';
      await rendered(app);
      Object.defineProperty(img().element, 'complete', { value: complete, configurable: true });
      const set = vi.spyOn(img().element, 'setAttribute');
      app.fm.api.inprocess = inprocess;
      app.fm.modals.open('imagepreview');
      await rendered(app);
      await rendered(app);
      return set;
    };

    it('sets src again so that load fires', async () => {
      const set = await reopen(true);
      expect(set).toHaveBeenCalledWith('src', '/p/photo.png');
    });

    it('leaves src alone while the image is still loading or when nothing is loading', async () => {
      expect(await reopen(false)).not.toHaveBeenCalled();
      app.wrapper.unmount();
      expect(await reopen(true, false)).not.toHaveBeenCalled();
    });
  });
});
