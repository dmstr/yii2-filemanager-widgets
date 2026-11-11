// Shared harness config: what FileManagerWidget produces by default, with every
// handler URL pointing at the mock API. Plain classic script, loaded by both pages.
// Optional query flags to reach UI paths the widget defaults switch off:
//   ?allow=rename,changePermissions   turns those allowedActions on
//   ?editable=1                       makes .txt and .svg editable
(function () {
  var handlerUrl = '/mock/api';
  var params = new URLSearchParams(window.location.search);

  var config = {
    appName: 'Mock files',
    defaultLang: 'en',
    searchForm: true,
    sidebar: true,
    breadcrumb: true,
    hidePermissions: true,

    listUrl: handlerUrl,
    uploadUrl: handlerUrl,
    renameUrl: handlerUrl,
    copyUrl: handlerUrl,
    moveUrl: handlerUrl,
    removeUrl: handlerUrl,
    getContentUrl: handlerUrl,
    createFolderUrl: handlerUrl,
    downloadFileUrl: handlerUrl,
    downloadMultipleUrl: handlerUrl,
    compressUrl: handlerUrl,
    extractUrl: handlerUrl,
    permissionsUrl: handlerUrl,
    // Not set by the widget (legacy falls back to bridges/php/handler.php); pointed at the mock so edit can be tried.
    editUrl: handlerUrl,

    multipleDownloadFileName: 'filemanager.zip',
    showSizeForDirectories: false,
    useBinarySizePrefixes: false,
    downloadFilesByAjax: true,
    previewImagesInModal: true,
    enablePermissionsRecursive: false,
    enableThumbnails: false,
    enableIconPreviewView: false,

    // Real RegExp objects, as FileManagerWidget's placeholder replacement produces.
    isEditableFilePattern: /\.(!)/i,
    isImageFilePattern: /\.(jpe?g|gif|bmp|png|svg|tiff?)$/i,
    isExtractableFilePattern: /\.(gz|tar|rar|g?zip)$/i,

    allowedActions: {
      upload: true,
      rename: false,
      move: true,
      copy: true,
      edit: true,
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
      changePermissions: false,
      customFileActions: false,
      customDirActions: false
    }
  };

  (params.get('allow') || '').split(',').forEach(function (name) {
    if (name in config.allowedActions) config.allowedActions[name] = true;
  });
  if (params.get('editable')) config.isEditableFilePattern = /\.(txt|svg)$/i;

  window.fileManagerConfig = config;
})();
