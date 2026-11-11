# CHANGELOG

### 2.0.0

The frontend of `FileManagerWidget` is rewritten in Vue 3. Look and behaviour are unchanged apart from the fixes below; widget usage and all widget properties stay as they are.

Breaking changes:

- the `angular.module('FileManagerApp').config(...)` hook is gone; host scripts configure the file manager through `window.fileManagerConfig` (an object, merged over the defaults when the bundle starts). `FileManagerWidget` deep-merges its own options into an existing `window.fileManagerConfig`, so keys a host script set earlier survive unless the widget sets the same key
- `hrzg\filemanager\assets\AfmBowerAsset` is removed together with the AngularJS libraries it published
- the asset bundle `hrzg\filemanager\assets\AfmAsset` is renamed to `hrzg\filemanager\assets\FileManagerAsset`; adjust code that references it (`use` statements, `depends` lists, `AfmAsset::register()`, `AfmAsset::getPublishedUrl()`)
- `FileManagerAsset` registers the compiled `filemanager.css` and `filemanager.js` (at the end of the body, no longer in the head) and depends on `yii\bootstrap\BootstrapAsset` only: the widget needs no jQuery and no Bootstrap JavaScript (a host page that relied on this bundle to load them, through `BootstrapPluginAsset` or `YiiAsset`, must register them itself), but Bootstrap 3 CSS with Glyphicons must be present. Only `filemanager.css`, `filemanager.js` and the notice file `filemanager.licenses.txt` (the licences of what is compiled into the two bundles) are published to the web root
- the stylesheet is shipped compiled (`filemanager.css`), the host application no longer needs a LESS converter
- the root element `<angular-filemanager>` is renamed to `<hrzg-filemanager>`, without an alias: the stylesheet is scoped to the new name. The default `FileManagerWidget::$template` is now only `<hrzg-filemanager></hrzg-filemanager>`, without the AngularJS bootstrap (`data-ng-app`, `ng-cloak` wrapper). Custom `$template` strings must use the new tag, and host CSS or JavaScript that targets `angular-filemanager` must target `hrzg-filemanager` instead
- the unused dependency `yii2assets/yii2-fullscreen-modal` is removed; a host application that relied on this package to pull it in must require it itself. `yiisoft/yii2-bootstrap` is now required explicitly (it came in through `yii2-fullscreen-modal` before)
- the environment variables `AFM_TITLE` and `AFM_HANDLER_URL` are renamed to `FILEMANAGER_TITLE` and `FILEMANAGER_HANDLER_URL`; the old names are no longer read, rename them in env files and container configuration
- the i18n message category `afm` is renamed to `filemanager` (the package registers it as the exact key `filemanager`, not as a wildcard); an application that provides its own translations for the `afm` category, for example in a database message source, must move them to the category `filemanager`
- the element IDs of the buttons rendered by `FileManagerInputWidget` change from `<input id>-afm-copy-btn`, `-afm-link-btn` and `-afm-download-btn` to `<input id>-filemanager-copy-btn`, `-filemanager-link-btn` and `-filemanager-download-btn`; adjust scripts and styles that target them
- the element IDs in the "copy link" dialog change from `afm-path-link`, `afm-stream-link` and `afm-download-link` to `filemanager-path-link`, `filemanager-stream-link` and `filemanager-download-link`, and the IDs of custom URL fields from `afm-<key>-link` to `filemanager-<key>-link`; adjust scripts and styles that target them

Fixes:

- the widget properties `enableThumbnails` and `enableIconPreviewView` take effect; they were declared but never read, so the filefly settings of the same name did nothing. They set the defaults, and `options` can still override them
- without a title (neither the `title` property nor the env variable) the breadcrumb shows "/" instead of "false" as the link to the root folder
- a failed folder listing no longer blocks all later refreshes until the page is reloaded
- "Permissions" in the context menu only shows when exactly one item is selected (it raised a JavaScript error otherwise)
- in the "copy link" dialog the copy buttons of custom URLs copy their own field instead of the download link
- an empty response from the backend shows the error message instead of raising a JavaScript error
- pasting text into the file manager, for example into the search field, or dropping something that is not a file no longer opens the upload dialog with an empty list

###1.0.0-dev

- added mandatory `handlerUrl` propery for `FileManagerInputWidget`