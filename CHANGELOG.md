# CHANGELOG

### 2.0.0

The frontend of `FileManagerWidget` is rewritten in Vue 3. Look and behaviour are unchanged; widget usage and all widget properties stay as they are.

Breaking changes:

- the `angular.module('FileManagerApp').config(...)` hook is gone; host scripts configure the file manager through `window.fileManagerConfig` (an object, merged over the defaults when the bundle starts)
- `AfmBowerAsset` is removed together with the AngularJS libraries as dependency
- `FileManagerWidget::$template` no longer bootstraps AngularJS (`data-ng-app`, `ng-cloak` wrapper); only `<angular-filemanager>` remains
- the stylesheet is shipped compiled (`filemanager.css`), the host application no longer needs a LESS converter
- `AfmAsset` registers `filemanager.css` and `filemanager.js` (at the end of the body) and depends on `yii\bootstrap\BootstrapAsset` only: the widget needs no jQuery and no Bootstrap JavaScript, but Bootstrap 3 CSS with Glyphicons must be present

Fixes:

- a failed folder listing no longer blocks all later refreshes until the page is reloaded
- "Permissions" in the context menu only shows when exactly one item is selected (it raised a JavaScript error otherwise)
- in the "copy link" dialog the copy buttons of custom URLs copy their own field instead of the download link
- an empty response from the backend shows the error message instead of raising a JavaScript error

###1.0.0-dev

- added mandatory `handlerUrl` propery for `FileManagerInputWidget`