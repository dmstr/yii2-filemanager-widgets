/**
 * The dialog actions that change files or permissions, each with the
 * validation, error key, refresh and close behaviour of the AngularJS
 * controller. On an empty or multiple selection where AngularJS code threw and
 * AngularJS swallowed it (Q-29: expressions on an empty selection; Q-03: permissions need exactly one item) they return without doing anything.
 */
import { ref } from 'vue';
import type { Item } from '../../models/Item.ts';
import { settled, type FileManagerContext } from './types.ts';

export function createDialogActions(ctx: FileManagerContext) {
  const { config, i18n, api, navigator, selection, destination, modal } = ctx;
  const invalidName = (): false => {
    api.error = i18n.t('error_invalid_filename');
    return false;
  };

  const uploadFileList = ref<File[]>([]);

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

  /**
   * Loads the roles, then opens the dialog. AngularJS quirk: the error set for a
   * failed request is wiped again at once, because opening the dialog clears
   * `api.error`; the dialog opens either way.
   */
  function updatePermissions(): void {
    const item = selection.singleSelection();
    if (!item) {
      return;
    }
    api
      .resolvePermissions(item.model.fullPath())
      .then(
        (data) => {
          item.model.authRead = data.auth.read;
          item.model.authUpdate = data.auth.update;
          item.model.authDelete = data.auth.delete;
        },
        () => {
          api.error = i18n.t('error_get_permissions');
        },
      )
      .finally(() => modal('changepermissions', false))
      .catch((error: unknown) => console.error(error));
  }

  function changePermissions(): void {
    const item = selection.singleSelection();
    if (!item) {
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

  function copy(): false | undefined {
    const item = selection.singleSelection();
    if (item && nameInvalid(item.tempModel.name.trim(), item)) {
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
    const anyItem = selection.singleSelection() || selection.temps.value[0];
    if (anyItem && destination.validateSamePath(anyItem)) {
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
