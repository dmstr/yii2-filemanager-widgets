/**
 * HTTP client of the file manager: the merge of the legacy `apiHandler` (HTTP
 * calls, loading and error state) and `apiMiddleware` (items to paths, URL per
 * action from the config). Every instance has its own `inprocess`/`error`
 * state, as every `new ApiMiddleware()` had.
 */
import { reactive } from 'vue';
import type { FileManagerConfig } from '../config/types.ts';
import type { I18n } from '../i18n/index.ts';
import type { Item, ItemModel } from '../models/Item.ts';
import { param } from '../utils/param.ts';
import { slug } from '../utils/slug.ts';
import { REQUEST_HEADERS, isSuccess, parseBody, request, type HttpResult } from './http.ts';

/** Shape of a decoded API response; every part is optional on the wire. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ApiData = { result?: any; error?: { message?: string }; auth?: any; [key: string]: any };

export interface Deferred {
  resolve(value: unknown): void;
  reject(value: unknown): void;
}

/** Decides whether a response settles the promise as success or failure. */
export type DeferredHandler = (data: unknown, deferred: Deferred, code: number, defaultMsg?: string) => void;

const BRIDGE_ERROR = 'Error %s - Bridge response error, please check the API docs or this ajax response.';
const NOT_FOUND_ERROR = 'Error 404 - Backend bridge is not working, please check the ajax response.';

/**
 * Legacy `deferredHandler`, shared by the API client and the navigator, which each keep the error
 * in their own state (`target.error`). Q-30 fixed: a response without a body (network failure,
 * empty reply) no longer throws; the bridge error is the result. `result.error` replaces an error
 * that is already set for the API client, while the navigator keeps the first one
 * (`overwriteWithResultError` false).
 */
export function settleDeferred(
  target: { error: string },
  data: unknown,
  deferred: Deferred,
  code: number,
  defaultMsg: string | undefined,
  overwriteWithResultError: boolean,
): void {
  const body: ApiData = data !== null && typeof data === 'object' ? (data as ApiData) : {};
  if (!data || typeof data !== 'object') {
    target.error = BRIDGE_ERROR.replace('%s', String(code));
  }
  if (code == 404) {
    target.error = NOT_FOUND_ERROR;
  }
  if ((overwriteWithResultError || !target.error) && body.result && body.result.error) {
    target.error = body.result.error;
  }
  if (!target.error && body.error) {
    target.error = body.error.message as string;
  }
  if (!target.error && defaultMsg) {
    target.error = defaultMsg;
  }
  if (target.error) {
    return deferred.reject(data);
  }
  return deferred.resolve(data);
}

type Selection = Array<Item | undefined>;

export interface Api {
  inprocess: boolean;
  asyncSuccess: boolean;
  error: string;
  /** Upload progress; unset until the first upload starts, as the legacy handler never initialised it. */
  progress: number | undefined;
  list(path: string[], customHandler?: DeferredHandler, recycle?: boolean): Promise<ApiData>;
  copy(files: Selection, path: string[]): Promise<ApiData>;
  move(files: Selection, path: string[]): Promise<ApiData>;
  remove(files: Selection): Promise<ApiData>;
  upload(files: ArrayLike<File>, path: string[]): Promise<ApiData>;
  getContent(item: Item): Promise<ApiData>;
  edit(item: Item): Promise<ApiData>;
  rename(item: Item): Promise<ApiData>;
  getUrl(item: Item): string | undefined;
  getPreviewUrl(item: Item): string | undefined;
  download(item: Item, forceNewWindow?: boolean): Promise<unknown> | boolean | undefined;
  downloadMultiple(files: Selection, forceNewWindow?: boolean): Promise<unknown> | boolean;
  compress(files: Selection, compressedFilename: string, path: string[]): Promise<ApiData>;
  extract(item: Item, folderName: string, path: string[]): Promise<ApiData>;
  changePermissions(item: ItemModel): Promise<ApiData>;
  createFolder(item: Item): Promise<ApiData>;
  /** The legacy controller called `$http` directly for this one: no `inprocess`, no `error`, no handler. */
  resolvePermissions(path: string): Promise<ApiData>;
}

interface SaveAsWindow {
  saveAs?: (blob: Blob, filename?: string) => void;
}

const getPath = (arrayPath: string[]): string => '/' + arrayPath.join('/');
const getFilePath = (item: Item | undefined): string | undefined => item && item.model.fullPath();
const getFileList = (files: Selection | undefined): Array<string | undefined> =>
  (files || []).map((file) => file && file.model.fullPath());

/** `[url, $.param(data)].join('?')`; Q-36: a handler URL that already has a query gets a second `?`. */
const withQuery = (url: string, data: Record<string, unknown>): string => [url, param(data)].join('?');

/**
 * The legacy item model carried two fields the port's `Item` dropped as
 * dead code, `dirName` and `recursive`, but the permissions request sends the
 * whole model, so they are put back on the wire in their original position.
 */
function permissionsPayload(model: ItemModel): Record<string, unknown> {
  const { name, thumbnail, preview, urls, extension, path, type, size, date, perms, content, fullPath, ...rest } = model;
  void fullPath;
  return { name, thumbnail, preview, urls, extension, dirName: '', path, type, size, date, perms, content, recursive: false, ...rest };
}

/** Creates an API client reading its URLs from `config` at call time, so later config changes apply. */
export function createApi(config: FileManagerConfig, i18n: I18n): Api {
  // Assigned right below; the functions only run after that.
  let api: Api;

  const deferredHandler: DeferredHandler = (data, deferred, code, defaultMsg) =>
    settleDeferred(api, data, deferred, code, defaultMsg, true);

  /** Runs a request the way every legacy method did: flags first, handler on the outcome, `inprocess` cleared last. */
  function call(
    method: 'GET' | 'POST',
    url: string,
    body: unknown,
    defaultMsg: () => string,
    handler: DeferredHandler = deferredHandler,
    clearError = true,
  ): Promise<ApiData> {
    api.inprocess = true;
    if (clearError) {
      api.error = '';
    }
    return new Promise<ApiData>((resolve, reject) => {
      const deferred: Deferred = { resolve: resolve as Deferred['resolve'], reject };
      request(method, url, body)
        .then(
          ({ data, status }) => handler(data, deferred, status),
          ({ data, status }: HttpResult) => handler(data, deferred, status, defaultMsg()),
        )
        .catch((error: unknown) => console.error(error))
        .finally(() => {
          api.inprocess = false;
        });
    });
  }

  const post = (url: string, data: Record<string, unknown>, defaultMsg: () => string) =>
    call('POST', url, data, defaultMsg);

  /** Legacy `download` / `downloadMultiple` switch (Q-20): the ajax branch needs `saveAs` from the host app. */
  function opensNewWindow(forceNewWindow?: boolean): boolean {
    return !config.downloadFilesByAjax || !!forceNewWindow || !(window as SaveAsWindow).saveAs;
  }

  /** Ajax download branch. The body is read as text and wrapped in a Blob, as `$http` delivered it. */
  function downloadByAjax(url: string, toFilename: string): Promise<unknown> {
    api.inprocess = true;
    return new Promise((resolve, reject) => {
      const deferred: Deferred = { resolve, reject };
      request('GET', url)
        .then(
          ({ data }) => {
            const bin = new Blob([data as BlobPart]);
            deferred.resolve(data);
            (window as SaveAsWindow).saveAs?.(bin, toFilename);
          },
          ({ data, status }: HttpResult) => deferredHandler(data, deferred, status, i18n.t('error_downloading')),
        )
        .catch((error: unknown) => console.error(error))
        .finally(() => {
          api.inprocess = false;
        });
    });
  }

  function upload(files: ArrayLike<File>, path: string[]): Promise<ApiData> {
    if (typeof FormData === 'undefined') {
      throw new Error('Unsupported browser version');
    }
    const destination = getPath(path);
    api.inprocess = true;
    api.progress = 0;
    api.error = '';

    return new Promise<ApiData>((resolve, reject) => {
      const deferred: Deferred = { resolve: resolve as Deferred['resolve'], reject };
      // Legacy edge case: with no files nothing is sent, the promise never
      // settles and `inprocess` stays true until the next call resets it.
      if (!(files && files.length)) {
        return;
      }
      const form = new FormData();
      form.append('destination', destination);
      for (let i = 0; i < files.length; i++) {
        form.append('file-' + i, files[i], files[i].name);
      }

      const xhr = new XMLHttpRequest();
      xhr.open('POST', config.uploadUrl);
      for (const [name, value] of Object.entries(REQUEST_HEADERS)) {
        xhr.setRequestHeader(name, value);
      }
      // Q-34: the percentage minus one, so it never shows more than 99.
      const onProgress = (event: ProgressEvent): void => {
        api.progress = Math.min(100, parseInt(String((100.0 * event.loaded) / event.total))) - 1;
      };
      xhr.upload.addEventListener('progress', onProgress);
      xhr.upload.addEventListener('load', (event) => event.lengthComputable && onProgress(event));

      const settle = (data: unknown, status: number): void => {
        if (isSuccess(status)) {
          deferredHandler(data, deferred, status);
        } else {
          deferredHandler(data, deferred, status, 'Unknown error uploading files');
        }
        api.inprocess = false;
        api.progress = 0;
      };
      xhr.onload = () => settle(parseBody(xhr.responseText, xhr.getResponseHeader('Content-Type')), xhr.status);
      const failed = () => settle(null, -1);
      xhr.onerror = failed;
      xhr.onabort = failed;
      xhr.ontimeout = failed;
      xhr.send(form);
    });
  }

  api = reactive<Api>({
    inprocess: false,
    asyncSuccess: false,
    error: '',
    progress: undefined,

    list(path, customHandler, recycle) {
      return call(
        'POST',
        config.listUrl,
        { action: 'list', path: getPath(path), recycle },
        () => 'Unknown error listing, check the response',
        customHandler,
      );
    },

    copy(files, path) {
      const items = getFileList(files);
      const singleFilename = items.length === 1 ? (files[0] as Item).tempModel.name : undefined;
      const data: Record<string, unknown> = { action: 'copy', items, newPath: getPath(path) };
      // Q-14: filefly reads `newFilename`, so this name never arrives.
      if (singleFilename && items.length === 1) {
        data.singleFilename = singleFilename;
      }
      return post(config.copyUrl, data, () => i18n.t('error_copying'));
    },

    move(files, path) {
      return post(
        config.moveUrl,
        { action: 'move', items: getFileList(files), newPath: getPath(path) },
        () => i18n.t('error_moving'),
      );
    },

    remove(files) {
      return post(config.removeUrl, { action: 'remove', items: getFileList(files) }, () => i18n.t('error_deleting'));
    },

    upload,

    getContent(item) {
      return post(config.getContentUrl, { action: 'getContent', item: getFilePath(item) }, () =>
        i18n.t('error_getting_content'),
      );
    },

    edit(item) {
      return post(
        config.editUrl,
        { action: 'edit', item: getFilePath(item), content: item.tempModel.content },
        () => i18n.t('error_modifying'),
      );
    },

    rename(item) {
      return post(
        config.renameUrl,
        { action: 'rename', item: getFilePath(item), newItemPath: item.tempModel.fullPath() },
        () => i18n.t('error_renaming'),
      );
    },

    getUrl(item) {
      const path = getFilePath(item);
      return path && withQuery(config.downloadFileUrl, { action: 'download', path });
    },

    getPreviewUrl(item) {
      if (item.model && item.model.preview !== '') {
        return item.model.preview;
      }
      return api.getUrl(item);
    },

    download(item, forceNewWindow) {
      if (item.isFolder()) {
        return undefined;
      }
      const url = api.getUrl(item) as string;
      if (opensNewWindow(forceNewWindow)) {
        return !!window.open(url, '_blank', '');
      }
      return downloadByAjax(url, item.model.name);
    },

    downloadMultiple(files, forceNewWindow) {
      // Q-35: characters 9 to 13 of the millisecond timestamp.
      const timestamp = new Date().getTime().toString().substr(8, 13);
      const toFilename = timestamp + '-' + config.multipleDownloadFileName;
      const url = withQuery(config.downloadMultipleUrl, {
        action: 'downloadMultiple',
        items: getFileList(files),
        toFilename,
      });
      if (opensNewWindow(forceNewWindow)) {
        return !!window.open(url, '_blank', '');
      }
      // Q-20: legacy requests the bare URL here, without any parameter.
      return downloadByAjax(config.downloadMultipleUrl, toFilename);
    },

    compress(files, compressedFilename, path) {
      return post(
        config.compressUrl,
        { action: 'compress', items: getFileList(files), destination: getPath(path), compressedFilename },
        () => i18n.t('error_compressing'),
      );
    },

    extract(item, folderName, path) {
      return post(
        config.extractUrl,
        { action: 'extract', item: getFilePath(item), destination: getPath(path), folderName },
        () => i18n.t('error_extracting'),
      );
    },

    changePermissions(item) {
      return post(config.permissionsUrl, { action: 'changePermissions', path: item.fullPath(), item: permissionsPayload(item) }, () =>
        i18n.t('error_changing_perms'),
      );
    },

    createFolder(item) {
      // Q-28: the controller checks the typed name first, the slug is applied only now.
      item.tempModel.name = slug(item.tempModel.name);
      return post(config.createFolderUrl, { action: 'createFolder', newPath: item.tempModel.fullPath() }, () =>
        i18n.t('error_creating_folder'),
      );
    },

    resolvePermissions(path) {
      return request('POST', config.permissionsUrl, { action: 'resolvePermissions', path }).then(
        ({ data }) => data as ApiData,
      );
    },
  });
  return api;
}
