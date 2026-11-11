# CHANGELOG

### 2.0.0

The frontend of `FileManagerWidget` is rewritten in Vue 3. Look and behaviour are unchanged; widget usage and all widget properties stay as they are.

Breaking changes:

- the `angular.module('FileManagerApp').config(...)` hook is gone; host scripts configure the file manager through `window.fileManagerConfig` (an object, merged over the defaults when the bundle starts)
- `AfmBowerAsset` is removed together with the AngularJS libraries as dependency
- `FileManagerWidget::$template` no longer bootstraps AngularJS (`data-ng-app`, `ng-cloak` wrapper); only `<angular-filemanager>` remains
- the stylesheet is shipped compiled (`filemanager.css`), the host application no longer needs a LESS converter
- the unused dependency `yii2assets/yii2-fullscreen-modal` is removed; a host application that relied on this package to pull it in must require it itself
- `FileManagerAsset` registers `filemanager.css` and `filemanager.js` (at the end of the body) and depends on `yii\bootstrap\BootstrapAsset` only: the widget needs no jQuery and no Bootstrap JavaScript, but Bootstrap 3 CSS with Glyphicons must be present
- the asset bundle `hrzg\filemanager\assets\AfmAsset` is renamed to `hrzg\filemanager\assets\FileManagerAsset`; adjust code that references it (`use` statements, `depends` lists, `AfmAsset::register()`, `AfmAsset::getPublishedUrl()`)
- the environment variables `AFM_TITLE` and `AFM_HANDLER_URL` are renamed to `FILEMANAGER_TITLE` and `FILEMANAGER_HANDLER_URL`; the old names are no longer read, rename them in env files and container configuration
- the i18n message category `afm` is renamed to `filemanager` (the package registers it as the exact key `filemanager`, not as a wildcard); an application that provides its own translations for the `afm` category, for example in a database message source, must move them to the category `filemanager`
- the element IDs of the buttons rendered by `FileManagerInputWidget` change from `<input id>-afm-copy-btn`, `-afm-link-btn` and `-afm-download-btn` to `<input id>-filemanager-copy-btn`, `-filemanager-link-btn` and `-filemanager-download-btn`; adjust scripts and styles that target them

Fixes:

- the widget properties `enableThumbnails` and `enableIconPreviewView` take effect; they were declared but never read, so the filefly settings of the same name did nothing
- without a title (neither the `title` property nor the env variable) the breadcrumb root is empty instead of showing "false"
- a failed folder listing no longer blocks all later refreshes until the page is reloaded
- "Permissions" in the context menu only shows when exactly one item is selected (it raised a JavaScript error otherwise)
- in the "copy link" dialog the copy buttons of custom URLs copy their own field instead of the download link
- an empty response from the backend shows the error message instead of raising a JavaScript error

###1.0.0-dev

- added mandatory `handlerUrl` propery for `FileManagerInputWidget`