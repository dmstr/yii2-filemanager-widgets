Yii2 Filemanager Widgets
========================

[![Latest Stable Version](https://poser.pugx.org/dmstr/yii2-filemanager-widgets/v/stable.svg)](https://packagist.org/packages/dmstr/yii2-filemanager-widgets) 
[![Total Downloads](https://poser.pugx.org/dmstr/yii2-filemanager-widgets/downloads.svg)](https://packagist.org/packages/dmstr/yii2-filemanager-widgets)
[![License](https://poser.pugx.org/dmstr/yii2-filemanager-widgets/license.svg)](https://packagist.org/packages/dmstr/yii2-filemanager-widgets)

A smart filemanager to manage your files in the browser, built with Vue 3 for Yii2 and Bootstrap 3

Installation
------------

#### Global ENV variables

Variable | Value
------------- | -------------
FILEMANAGER_TITLE | 'My Filemanager'
FILEMANAGER_HANDLER_URL | '/filefly/api'


Filemanager widget
------------------

General usage

```
echo \hrzg\filemanager\widgets\FileManagerWidget::widget();
```

Use in TWIG templates:

```
{{ use ('hrzg/filemanager/widgets') }}

{{ file_manager_widget_widget() }}
```

Requirements: the host page must load the Bootstrap 3 CSS including the Glyphicons font (the widget depends on `yii\bootstrap\BootstrapAsset`). Neither jQuery nor Bootstrap JavaScript is needed.

#### Options

The widget writes its configuration to `window.fileManagerConfig`, the bundle merges it over its defaults. Pass options with the `options` property, they are merged over the widget defaults:

```
echo \hrzg\filemanager\widgets\FileManagerWidget::widget([
    'handlerUrl' => '/filefly/api',
    'options' => [
        'allowedActions' => ['rename' => true],
    ],
]);
```

The three pattern options (`isEditableFilePattern`, `isImageFilePattern`, `isExtractableFilePattern`) are strings in regular expression literal notation, for example `'/\.(jpe?g|png)$/i'`.

#### Callbacks

Functions cannot travel through PHP. A host script adds them to `window.fileManagerConfig` and must run before the file manager starts, i.e. as inline script in the head or at the end of the body (not in `jQuery(document).ready`, which runs after the bundle has mounted):

```
var config = window.fileManagerConfig = window.fileManagerConfig || {};
config.allowedActions = config.allowedActions || {};
config.pickCallback = function (item) { /* return true to stop the default action */ };
config.allowedActions.pickFiles = true;
config.allowedActions.customFileActions = {'My action': function (item) {}};
```

Register such a script with `$this->registerJs($js, \yii\web\View::POS_END)`; set single keys rather than replacing `allowedActions` as a whole, or the widget's values are lost. The custom actions `customFileActions` and `customDirActions` are objects of `label => callback` and are enabled by listing them in `allowedActions` as shown.

#### Development

The source of the Vue 3 bundle lives in `./frontend/`, see [frontend/README.md](frontend/README.md) for development and building. The build writes `src/assets/dist/filemanager.js` and `filemanager.css`.


Input widget
------------

General usage

```
echo \hrzg\filemanager\widgets\FileManagerInputWidget::widget(['name' => 'myInputWidget']);
```

Use it with an ActiveForm

```
echo $form->field($model, 'image')->widget('\hrzg\filemanager\widgets\FileManagerInputWidget');
```

Use in TWIG templates:

```
{{ use ('hrzg/filemanager/widgets') }}

{{ file_manager_input_widget_widget({"name" : "myInputWidget"}) }}
```
