/**
 * The dialog actions that change files or permissions, each with the
 * validation, error key, refresh and close behaviour of the AngularJS
 * controller. On an empty or multiple selection where AngularJS code threw and
 * AngularJS swallowed it (Q-29: expressions on an empty selection; Q-03: permissions need exactly one item) they return without doing anything.
 */
import { ref, watch } from 'vue';
import type { Item, RoleSelection } from '../../models/Item.ts';
import { settled, type FileManagerContext } from './types.ts';

export function createDialogActions(ctx: FileManagerContext) {
  const { config, i18n, api, navigator, selection, destination, modal, modals } = ctx;
  const invalidName = (): false => {
    api.error = i18n.t('error_invalid_filename');
    return false;
  };

  const uploadFileList = ref<File[]>([]);

  // Cancel, the cross, Escape and the backdrop all end up closing the dialog in the modal manager, so
  // this is the one place that sees every way out. A completed upload has emptied the list already; a
  // failed one leaves the dialog open, so the list stays for a retry. The watcher is synchronous so
  // that a drop right after closing (`addForUpload` adds, then opens) keeps its fresh files.
  watch(
    () => modals.isOpen('uploadfile'),
    (open) => {
      if (!open) {
        uploadFileList.value = [];
      }
    },
    { flush: 'sync' },
  );

  /**
   * A failed write may still have changed the backend (a folder deleted with a
   * "not allowed" note, the accepted files of a partly rejected upload), so the
   * listing is reloaded. The open dialog keeps its content: a regular refresh
   * clears the selection, which the dialogs render from.
   */
  const reloadAfterFailure = (): void => {
    navigator.refresh(false, true);
  };

  function edit(): void {
    const item = selection.singleSelection();
    if (!item) {
      return;
    }
    settled(api.edit(item), () => modal('edit', true));
  }

  /** True while the open permissions dialog has no roles to show because loading them failed; the submit is disabled then. */
  const permissionsLoadFailed = ref(false);

  /**
   * Loads the roles, then opens the dialog. A failed load opens it as well,
   * because its error bar is the only place an action error can be shown, but
   * with empty role lists and with the submit disabled, so nothing of an earlier
   * load is shown or saved for this item. The edited role lists start empty:
   * the selectors fill them with the ticked roles of each loaded list, and a
   * section without roles must not keep what an earlier edit left there.
   */
  function updatePermissions(): void {
    const item = selection.singleSelection();
    if (!item) {
      return;
    }
    // `auth` is falsy for a failed request and for a response without roles.
    const show = (auth: Partial<Record<'read' | 'update' | 'delete', unknown>> | undefined): void => {
      const roles = (section: unknown) => (Array.isArray(section) ? (section as RoleSelection[]) : null);
      item.model.authRead = roles(auth?.read);
      item.model.authUpdate = roles(auth?.update);
      item.model.authDelete = roles(auth?.delete);
      item.tempModel.authRead = [];
      item.tempModel.authUpdate = [];
      item.tempModel.authDelete = [];
      permissionsLoadFailed.value = !auth;
      modal('changepermissions', false);
      if (!auth) {
        // Set after opening, which clears the error.
        api.error = i18n.t('error_get_permissions');
      }
    };
    api
      .resolvePermissions(item.model.fullPath())
      .then(
        (data) => show(data?.auth || undefined),
        () => show(undefined),
      )
      .catch((error: unknown) => console.error(error));
  }

  function changePermissions(): void {
    const item = selection.singleSelection();
    if (!item || permissionsLoadFailed.value) {
      return;
    }
    settled(api.changePermissions(item.tempModel), () => modal('changepermissions', true));
  }

  function rename(): false | undefined {
    const item = selection.singleSelection();
    if (!item) {
      return;
    }
    const name = item.tempModel.name;
    const samePath = item.tempModel.path.join('') === item.model.path.join('');
    if (!name || (samePath && navigator.fileNameExists(name))) {
      return invalidName();
    }
    settled(
      api.rename(item),
      () => {
        navigator.refresh();
        modal('rename', true);
      },
      reloadAfterFailure,
    );
  }

  function refreshLocation(recycle?: boolean): void {
    navigator.refresh(recycle);
  }

  /** The name check shared by copy, compress and extract. */
  function nameInvalid(name: string, item: Item | undefined): boolean {
    return !!(navigator.fileNameExists(name) && destination.validateSamePath(item)) || !name;
  }

  /** The first item stands for the selection; a leading hole in it (shift-click) skips the check. */
  function destinationIsItemsFolder(): boolean {
    const anyItem = selection.singleSelection() || selection.temps.value[0];
    return !!anyItem && destination.validateSamePath(anyItem);
  }

  function copy(): false | undefined {
    const item = selection.singleSelection();
    if (item && nameInvalid(item.tempModel.name.trim(), item)) {
      return invalidName();
    }
    // Several items cannot be renamed on the way, so a copy into their own folder would collide with the originals.
    if (!item && destinationIsItemsFolder()) {
      return invalidName();
    }
    settled(
      api.copy(selection.temps.value, destination.selectedModalPath.value),
      () => {
        navigator.refresh();
        modal('copy', true);
      },
      reloadAfterFailure,
    );
  }

  /** Compress and extract: with the `*Async` option the dialog stays open and shows a success note. */
  function archive(
    id: 'compress' | 'extract',
    run: (name: string) => Promise<unknown>,
    asyncOption: boolean,
  ): false | undefined {
    const temp = selection.temp.value;
    const name = temp.tempModel.name.trim();
    if (nameInvalid(name, temp)) {
      return invalidName();
    }
    settled(
      run(name),
      () => {
        navigator.refresh();
        if (!asyncOption) {
          modal(id, true);
          return;
        }
        api.asyncSuccess = true;
      },
      () => {
        api.asyncSuccess = false;
        reloadAfterFailure();
      },
    );
  }

  const compress = (): false | undefined =>
    archive(
      'compress',
      (name) => api.compress(selection.temps.value, name, destination.selectedModalPath.value),
      config.compressAsync,
    );

  const extract = (): false | undefined =>
    archive(
      'extract',
      (name) => api.extract(selection.temp.value, name, destination.selectedModalPath.value),
      config.extractAsync,
    );

  function remove(): void {
    settled(
      api.remove(selection.temps.value),
      () => {
        navigator.refresh();
        modal('remove', true);
      },
      reloadAfterFailure,
    );
  }

  function move(): false | undefined {
    if (destinationIsItemsFolder()) {
      api.error = i18n.t('error_cannot_move_same_path');
      return false;
    }
    settled(
      api.move(selection.temps.value, destination.selectedModalPath.value),
      () => {
        navigator.refresh();
        modal('move', true);
      },
      reloadAfterFailure,
    );
  }

  function createFolder(): false | undefined {
    const item = selection.singleSelection();
    if (!item) {
      return;
    }
    const name = item.tempModel.name;
    // Q-28: the slug is applied inside `api.createFolder`, after this check.
    if (!name || navigator.fileNameExists(name)) {
      return invalidName();
    }
    settled(
      api.createFolder(item),
      () => {
        navigator.refresh();
        modal('newfolder', true);
      },
      reloadAfterFailure,
    );
  }

  function addForUpload(files: ArrayLike<File>): void {
    uploadFileList.value = uploadFileList.value.concat(Array.from(files));
    modal('uploadfile');
  }

  function removeFromUpload(index: number): void {
    uploadFileList.value.splice(index, 1);
  }

  function uploadFiles(): void {
    settled(
      api.upload(uploadFileList.value, navigator.currentPath),
      () => {
        navigator.refresh();
        uploadFileList.value = [];
        modal('uploadfile', true);
      },
      (data) => {
        // The response may be missing altogether after a network failure.
        const result = (data as { result?: { error?: string } } | null)?.result;
        api.error = (result && result.error) || i18n.t('error_uploading_files');
        reloadAfterFailure();
      },
    );
  }

  return {
    uploadFileList,
    edit,
    permissionsLoadFailed,
    updatePermissions,
    changePermissions,
    rename,
    refreshLocation,
    copy,
    compress,
    extract,
    remove,
    move,
    createFolder,
    addForUpload,
    removeFromUpload,
    uploadFiles,
  };
}
