import type { FileManagerConfig } from './types.ts';

const HANDLER = 'bridges/php/handler.php';

/**
 * A fresh copy of the legacy provider defaults (without the dead `tplPath`).
 * A function rather than a constant so that merging never mutates shared state.
 */
export function createDefaults(): FileManagerConfig {
  return {
    appName: 'angular-filemanager v1.5',
    defaultLang: 'en',

    listUrl: HANDLER,
    uploadUrl: HANDLER,
    renameUrl: HANDLER,
    copyUrl: HANDLER,
    moveUrl: HANDLER,
    removeUrl: HANDLER,
    editUrl: HANDLER,
    getContentUrl: HANDLER,
    createFolderUrl: HANDLER,
    downloadFileUrl: HANDLER,
    downloadMultipleUrl: HANDLER,
    compressUrl: HANDLER,
    extractUrl: HANDLER,
    permissionsUrl: HANDLER,

    searchForm: true,
    sidebar: true,
    breadcrumb: true,
    allowedActions: {
      upload: true,
      rename: true,
      move: true,
      copy: true,
      edit: true,
      changePermissions: true,
      compress: true,
      compressChooseName: true,
      extract: true,
      download: true,
      downloadMultiple: true,
      downloadLink: true,
      preview: true,
      remove: true,
      createFolder: true,
      pickFiles: false,
      pickFolders: false,
      customFileActions: false,
      customDirActions: false,
    },

    multipleDownloadFileName: 'angular-filemanager.zip',
    showExtensionIcons: true,
    showSizeForDirectories: false,
    useBinarySizePrefixes: false,
    downloadFilesByAjax: true,
    previewImagesInModal: true,
    enablePermissionsRecursive: true,
    compressAsync: false,
    extractAsync: false,
    pickCallback: null,
    enableThumbnails: true,
    enableIconPreviewView: false,

    isEditableFilePattern:
      /\.(txt|diff?|patch|svg|asc|cnf|cfg|conf|html?|.html|cfm|cgi|aspx?|ini|pl|py|md|css|cs|js|jsp|log|htaccess|htpasswd|gitignore|gitattributes|env|json|atom|eml|rss|markdown|sql|xml|xslt?|sh|rb|as|bat|cmd|cob|for|ftn|frm|frx|inc|lisp|scm|coffee|php[3-6]?|java|c|cbl|go|h|scala|vb|tmpl|lock|go|yml|yaml|tsv|lst)$/i,
    isImageFilePattern: /\.(jpe?g|gif|bmp|png|svg|tiff?)$/i,
    isExtractableFilePattern: /\.(gz|tar|rar|g?zip)$/i,
  };
}
