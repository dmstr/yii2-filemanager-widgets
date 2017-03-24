Yii2-filemanager-widgets
========================

[![Latest Stable Version](https://poser.pugx.org/dmstr/yii2-filemanager-widgets/v/stable.svg)](https://packagist.org/packages/dmstr/yii2-filemanager-widgets) 
[![Total Downloads](https://poser.pugx.org/dmstr/yii2-filemanager-widgets/downloads.svg)](https://packagist.org/packages/dmstr/yii2-filemanager-widgets)
[![License](https://poser.pugx.org/dmstr/yii2-filemanager-widgets/license.svg)](https://packagist.org/packages/dmstr/yii2-filemanager-widgets)

A very smart filemanager to manage your files in the browser developed in AngularJS with Material-Design

Installation
------------

#### Global ENV variables

Variable | Value
------------- | -------------
AFM_TITLE | 'My Filemanager'
AFM_HANDLER_URL | '/filefly/api'
AFM_FILESYSTEM_BASE_PATH | '/app/src/_storage'


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
