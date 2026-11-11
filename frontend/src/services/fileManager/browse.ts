/**
 * Actions that open things rather than change files: the double-click
 * dispatcher, image preview, text editor, the link dialog, downloads and
 * custom actions. Port of that part of the AngularJS `FileManagerCtrl`.
 */
import { ref } from 'vue';
import type { Item } from '../../models/Item.ts';
import { noop } from '../../utils/noop.ts';
import { param } from '../../utils/param.ts';
import { settled, type FileManagerContext } from './types.ts';

export function createBrowseActions(ctx: FileManagerContext) {
  const { config, api, navigator, selection, modal } = ctx;

  // State the link dialog shows; AngularJS kept it on the scope, unset until first use.
  const dlLink = ref('');
  const streamLink = ref('');
  const path = ref('');
  const urls = ref<Record<string, string> | string[]>([]);
  const showDefaultUrls = ref(false);
  const showCustomUrls = ref(false);

  // The preview dialog binds this as image source; `api.inprocess` doubles as its loading flag.
  const previewUrl = ref('');

  /** Double-click: folders open, files go to `pickCallback` first, then image preview or editor. */
  function smartClick(item: Item): void {
    const pick = config.allowedActions.pickFiles;
    if (item.isFolder()) {
      return navigator.folderClick(item);
    }
    if (typeof config.pickCallback === 'function' && pick) {
      const callbackSuccess: unknown = config.pickCallback(item.model);
      if (callbackSuccess === true) {
        return;
      }
    }
    if (item.isImage()) {
      if (config.previewImagesInModal) {
        return openImagePreview();
      }
      api.download(item, true);
      return;
    }
    if (item.isEditable()) {
      return openEditItem();
    }
  }

  /**
   * Like the AngularJS function it previews the single selected item whatever
   * argument it gets; with nothing selected (Q-29) it does nothing.
   */
  function openImagePreview(): void {
    const item = selection.singleSelection();
    if (!item) {
      return;
    }
    api.inprocess = true;
    modal('imagepreview');
    previewUrl.value = api.getPreviewUrl(item) || '';
  }

  /** The preview image fired `load` or `error`. */
  function imageLoaded(): void {
    api.inprocess = false;
  }

  function openEditItem(): void {
    const item = selection.singleSelection();
    if (!item) {
      return;
    }
    settled(api.getContent(item), (data) => {
      item.tempModel.content = item.model.content = data.result;
    });
    modal('edit');
  }

  /** `callback` is a function (JS config only) or the name of a global function. */
  function customAction(_action: string, callback: unknown): false | undefined {
    const item = selection.singleSelection();
    if (typeof callback === 'function') {
      callback(item);
      return;
    }
    const global = (window as unknown as Record<string, unknown>)[callback as string];
    if (global && typeof global === 'function') {
      global(item);
    } else {
      window.console.error('custom action [' + callback + '] has to be defined in global window scope!');
      return false;
    }
  }

  /** Fills the link dialog state and opens it. Q-36: the handler URL gets `?` appended even if it has one. */
  function downloadLink(): void {
    const item = selection.singleSelection();
    if (selection.selectionHas('dir') || !item) {
      return;
    }
    const itemFullPath = item.model.fullPath();
    const domain = window.location.protocol + '//' + window.location.host;
    dlLink.value = domain + [config.downloadFileUrl, param({ action: 'download', path: itemFullPath })].join('?');
    streamLink.value = [config.downloadFileUrl, param({ action: 'stream', path: itemFullPath })].join('?');
    path.value = itemFullPath;
    urls.value = [];
    showDefaultUrls.value = true;
    showCustomUrls.value = false;
    // `.length !== 0` is true for an object of urls, which has no length.
    if (item.model.urls && (item.model.urls as unknown[]).length !== 0) {
      urls.value = item.model.urls;
      showDefaultUrls.value = false;
      showCustomUrls.value = true;
    }
    modal('downloadlink', false);
  }

  /**
   * One file downloads directly, several files as ZIP; a selection with a folder does nothing. The
   * Ajax branch is settled here and returns nothing: a promise returned to a template event handler
   * would send its rejection to Vue's error handler, while the AngularJS handler stayed silent (the
   * error is already on `api.error`).
   */
  function download(): boolean | undefined {
    const item = selection.singleSelection();
    if (selection.selectionHas('dir')) {
      return;
    }
    const result = item ? api.download(item) : api.downloadMultiple(selection.temps.value);
    if (result instanceof Promise) {
      settled(result, noop);
      return;
    }
    return result;
  }

  return {
    dlLink,
    streamLink,
    path,
    urls,
    showDefaultUrls,
    showCustomUrls,
    previewUrl,
    smartClick,
    openImagePreview,
    imageLoaded,
    openEditItem,
    customAction,
    customFileAction: customAction,
    customDirAction: customAction,
    downloadLink,
    download,
  };
}
