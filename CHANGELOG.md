# CHANGELOG

### 2.0.2

Fixes:

- the file table shows the modification time exactly as the server reports it, regardless of the browser's time zone; before, it was shifted by the browser's offset to UTC
- file sizes use correct units (kB = 1000 bytes, or KiB = 1024 bytes with `useBinarySizePrefixes`), have a single space before the unit, switch units at the right boundary and show `0.0 kB` for empty files
- texts fall back to the base language (`de-DE` uses German) and then to English instead of showing raw keys. Missing texts are defined in English and German: the error messages for moving and downloading, the view-switch tooltips, the labels of the role selector; the refresh button's tooltip reads "Refresh" instead of "Icons"
- the icon views list folders first and sort by the column and direction last chosen in the table, so the order no longer differs between views
- in the icon view with previews, an image without a thumbnail shows the picture icon instead of an empty tile
- the sidebar tree marks only the folders that really lie on the current path as open, and no longer keeps stale subfolders of a folder whose name is the beginning of another folder's name (for example `doc` and `documents`)
- Escape closes the topmost open dialog wherever the keyboard focus is, also in dialogs without an input field and when the folder selector is open on top of another dialog; an open role list in the permissions dialog still closes first
- with two dialogs open, the page behind no longer starts scrolling when the upper one closes, and the scrollbar padding on the page is removed reliably instead of staying and growing
- the rename, copy, extract, compress and edit dialogs always open with the item's current state; text typed and then cancelled no longer reappears or gets sent by a later action
- opening or cancelling the "New folder" dialog no longer changes the current selection, and a folder name is checked for duplicates and emptiness in the form that is actually created (`My Folder` is recognised as `my-folder`)
- closing the upload dialog without uploading empties the list of waiting files, so they are not uploaded to a different folder the next time the dialog opens; the upload progress reaches 100 %
- shift-clicking a file after the previously selected file was filtered out by the search field selects just the clicked file instead of producing a selection that counted one item too many
- the search field of the role selector in the permissions dialog filters by role name only
- the redundant "Close" button in the middle of the move and copy dialogs is removed
- dialog fields no longer empty themselves on every keystroke when no single item is selected, and the rename dialog no longer shows the word "false" as the item name

### 2.0.1

Changed defaults:

- `FileManagerWidget` no longer offers "Download as ZIP", "Compress" (including the name prompt) and "Extract" by default: `downloadMultiple`, `compress`, `compressChooseName` and `extract` are `false`. The filefly backend has no such actions, so the entries led to a 404 page or did nothing. A backend that implements them switches them back on in the widget's options: `'options' => ['allowedActions' => ['downloadMultiple' => true, 'compress' => true, 'compressChooseName' => true, 'extract' => true]]`

Fixes:

- if loading the permissions of a file or folder fails, the permissions dialog shows the error with no roles and cannot be saved. It no longer shows or saves the roles of a previously opened item, also not for a permission type the server returns no roles for
- copying a single file under a new name works: the name typed in the copy dialog is applied, where before the copy always kept the original name. An unchanged name is not sent, so the copy keeps the original name as before
- copying several items into the folder they are already in is refused in the dialog with an error message, instead of sending a request that fails on the server
- the file list is reloaded after a failed action (delete, move, copy, rename, new folder, upload, compress, extract), so changes the server already made show up at once, for example the accepted files of a partly rejected upload. The error message and the open dialog stay as they were
- when the folder is changed again before the previous one has finished loading, only the answer to the latest navigation is shown; before, the list could show the contents of the wrong folder
- handler URLs that already contain a query string, such as `/filefly/api?scope=my-scope`, work for downloads, previews and the "copy link" dialog: parameters are appended with `&` instead of a second `?`. Handler URLs without a query string behave exactly as before
- choosing a destination folder in the move, copy, compress and extract dialogs sends the same path (`/a/b`) whether the folder row's button or the button for the folder currently shown is used; the row button sent `//a/b`

### 2.0.0

The frontend of `FileManagerWidget` is rewritten in Vue 3. Look and behaviour are unchanged apart from the fixes below; widget usage and all widget properties stay as they are.

Breaking changes:

- the `angular.module('FileManagerApp').config(...)` hook is gone; host scripts configure the file manager through `window.fileManagerConfig` (an object, merged over the defaults when the bundle starts). `FileManagerWidget` deep-merges its own options into an existing `window.fileManagerConfig`, so keys a host script set earlier survive unless the widget sets the same key
- `hrzg\filemanager\assets\AfmBowerAsset` is removed together with the AngularJS libraries it published
- the asset bundle `hrzg\filemanager\assets\AfmAsset` is renamed to `hrzg\filemanager\assets\FileManagerAsset`; adjust code that references it (`use` statements, `depends` lists, `AfmAsset::register()`). The static helpers `getPublishedUrl()` and `$assetSourcePath` are removed; use `Yii::$app->assetManager->getPublishedUrl((new FileManagerAsset())->sourcePath)` where the published URL is needed
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