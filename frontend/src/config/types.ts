import type { ItemModel } from '../models/Item.ts';

/** A custom action callback: a function, or the name of a global function. */
export type CustomActionCallback = ((...args: unknown[]) => unknown) | string;

/** Label to callback; `false` switches the feature off. */
export type CustomActions = false | Record<string, CustomActionCallback>;

/** Receives the model of the item the user picked. */
export type PickCallback = (model: ItemModel) => void;

export interface AllowedActions {
  upload: boolean;
  rename: boolean;
  move: boolean;
  copy: boolean;
  edit: boolean;
  changePermissions: boolean;
  compress: boolean;
  compressChooseName: boolean;
  extract: boolean;
  download: boolean;
  downloadMultiple: boolean;
  downloadLink: boolean;
  preview: boolean;
  remove: boolean;
  createFolder: boolean;
  pickFiles: boolean;
  pickFolders: boolean;
  customFileActions: CustomActions;
  customDirActions: CustomActions;
}

/** Every option of the AngularJS provider plus the ones only PHP or templates know. */
export interface FileManagerConfig {
  appName: string;
  defaultLang: string;

  listUrl: string;
  uploadUrl: string;
  renameUrl: string;
  copyUrl: string;
  moveUrl: string;
  removeUrl: string;
  editUrl: string;
  getContentUrl: string;
  createFolderUrl: string;
  downloadFileUrl: string;
  downloadMultipleUrl: string;
  compressUrl: string;
  extractUrl: string;
  permissionsUrl: string;

  searchForm: boolean;
  sidebar: boolean;
  breadcrumb: boolean;
  /** Set by PHP only. */
  hidePermissions?: boolean;
  /** Read by the templates only; undefined by default. */
  hideSize?: boolean;
  /** Read by the templates only; undefined by default. */
  hideDate?: boolean;
  allowedActions: AllowedActions;

  multipleDownloadFileName: string;
  showExtensionIcons: boolean;
  showSizeForDirectories: boolean;
  useBinarySizePrefixes: boolean;
  downloadFilesByAjax: boolean;
  previewImagesInModal: boolean;
  /** Not read anywhere, kept because hosts may still send it. */
  enablePermissionsRecursive: boolean;
  compressAsync: boolean;
  extractAsync: boolean;
  pickCallback: PickCallback | null;
  enableThumbnails: boolean;
  enableIconPreviewView: boolean;

  isEditableFilePattern: RegExp;
  isImageFilePattern: RegExp;
  isExtractableFilePattern: RegExp;
}
