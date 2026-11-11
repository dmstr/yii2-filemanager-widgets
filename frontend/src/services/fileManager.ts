/**
 * Framework-level state of the whole file manager, without any UI: the port
 * of the legacy `FileManagerCtrl` and `ModalFileManagerCtrl`. The factory
 * composes the concern modules under `fileManager/` and returns one reactive
 * object that components read and call (refs and computeds unwrap on it).
 */
import { inject, provide, reactive, type InjectionKey } from 'vue';
import type { FileManagerConfig } from '../config/types.ts';
import type { I18n } from '../i18n/index.ts';
import { createApi } from './api.ts';
import { createDialogActions } from './fileManager/actions.ts';
import { createBrowseActions } from './fileManager/browse.ts';
import { createDestination } from './fileManager/destination.ts';
import { createSelection } from './fileManager/selection.ts';
import type { FileManagerContext } from './fileManager/types.ts';
import { createViewState } from './fileManager/view.ts';
import { createModalManager } from './modals.ts';
import { createNavigator } from './navigator.ts';
import { initialLocale, storeLocale } from './storage.ts';

export function createFileManager(config: FileManagerConfig, i18n: I18n) {
  const api = createApi(config, i18n);
  const modals = createModalManager();
  const navigator = createNavigator(config, i18n);
  const selectorNavigator = createNavigator(config, i18n);

  const view = createViewState(config, navigator);
  const selection = createSelection(config, navigator, view.fileList);

  /** Legacy `modal(id, hide)`: besides opening or closing it clears the dialog's error and async state. */
  function modal(id: string, hide?: boolean): true {
    if (hide) {
      modals.close(id);
    } else {
      modals.open(id);
    }
    api.error = '';
    api.asyncSuccess = false;
    return true;
  }

  const destination = createDestination({ navigator, selectorNavigator, selection, modal });
  const ctx: FileManagerContext = { config, i18n, api, navigator, modals, selection, destination, modal };
  const browse = createBrowseActions(ctx);
  const actions = createDialogActions(ctx);

  navigator.onRefresh = () => {
    selection.replace([]);
    view.query.value = '';
    destination.selectedModalPath.value = navigator.currentPath;
  };

  /** With a locale: remember and use it. Without: the stored language, else the configured default. */
  function changeLanguage(locale?: string): void {
    if (locale) {
      storeLocale(locale);
      i18n.use(locale);
      return;
    }
    i18n.use(initialLocale(config, ''));
  }

  /** The legacy start-up: language (query parameter, storage, default), then the first listing. */
  function init(): Promise<void> {
    i18n.use(initialLocale(config));
    return navigator.refresh();
  }

  return reactive({
    config,
    api,
    modals,
    navigator,
    modal,
    modalWithPathSelector: destination.modalWithPathSelector,
    isInThisPath: destination.isInThisPath,
    init,
    changeLanguage,

    // View state
    query: view.query,
    predicate: view.predicate,
    reverse: view.reverse,
    order: view.order,
    viewTemplate: view.viewTemplate,
    setTemplate: view.setTemplate,
    fileList: view.fileList,

    // Selection
    temps: selection.temps,
    temp: selection.temp,
    isSelected: selection.isSelected,
    selectOrUnselect: selection.selectOrUnselect,
    singleSelection: selection.singleSelection,
    totalSelecteds: selection.totalSelecteds,
    selectionHas: selection.selectionHas,
    prepareNewFolder: selection.prepareNewFolder,

    // Destination dialog (ModalFileManagerCtrl and the shared root scope values)
    selector: {
      navigator: destination.navigator,
      predicate: destination.predicate,
      reverse: destination.reverse,
      order: destination.order,
      fileList: destination.fileList,
    },
    selectedModalPath: destination.selectedModalPath,
    select: destination.select,
    selectCurrent: destination.selectCurrent,
    selectedFilesAreChildOfPath: destination.selectedFilesAreChildOfPath,
    openNavigator: destination.openNavigator,
    getSelectedPath: destination.getSelectedPath,

    ...browse,
    ...actions,
  });
}

export type FileManager = ReturnType<typeof createFileManager>;

const FILE_MANAGER_KEY: InjectionKey<FileManager> = Symbol('fileManager');

/** Makes the instance available to all descendants of the calling component. */
export function provideFileManager(instance: FileManager): void {
  provide(FILE_MANAGER_KEY, instance);
}

/** Returns the provided instance or throws when no ancestor called `provideFileManager`. */
export function useFileManager(): FileManager {
  const instance = inject(FILE_MANAGER_KEY, null);
  if (!instance) {
    throw new Error('useFileManager(): no file manager provided; call provideFileManager() in an ancestor component');
  }
  return instance;
}
