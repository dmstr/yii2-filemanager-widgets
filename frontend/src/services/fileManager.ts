/**
 * Framework-level state of the whole file manager, without any UI: the port
 * of the AngularJS `FileManagerCtrl` and `ModalFileManagerCtrl`. The factory
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

export function createFileManager(config: FileManagerConfig, i18n: I18n) {
  const api = createApi(config, i18n);
  const modals = createModalManager();
  const navigator = createNavigator(config, i18n);
  const selectorNavigator = createNavigator(config, i18n);

  const view = createViewState(config, navigator);
  const selection = createSelection(config, navigator, view.fileList);

  /**
   * Dialogs that edit the `tempModel` of the selected item (the compress dialog edits the placeholder's).
   * `move` is included because its path line shows the item's `tempModel.name`.
   */
  const TEMP_MODEL_DIALOGS = ['rename', 'copy', 'move', 'extract', 'edit', 'compress'];

  /**
   * AngularJS `modal(id, hide)`: besides opening or closing it clears the dialog's error and async state.
   * Opening a dialog that edits an item first resets that item's `tempModel`, so input abandoned in an
   * earlier dialog never shows up again or gets sent by another action. A dialog that is already open is
   * left alone, which keeps the input of a dialog that stays open after a failed submit.
   */
  function modal(id: string, hide?: boolean): true {
    if (hide) {
      modals.close(id);
    } else {
      if (TEMP_MODEL_DIALOGS.includes(id) && !modals.isOpen(id)) {
        selection.temp.value.revert();
      }
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

  navigator.onRefresh = (keepState) => {
    if (keepState) {
      return;
    }
    selection.replace([]);
    view.query.value = '';
    destination.selectedModalPath.value = navigator.currentPath;
  };

  /**
   * The AngularJS start-up after the language: the first listing. The language itself is resolved once
   * by `main.ts` (`initialLocale`) before the translator is created, so the first render already
   * uses it.
   */
  function init(): Promise<void> {
    return navigator.refresh();
  }

  return reactive({
    api,
    modals,
    navigator,
    modal,
    modalWithPathSelector: destination.modalWithPathSelector,
    isInThisPath: destination.isInThisPath,
    init,

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
