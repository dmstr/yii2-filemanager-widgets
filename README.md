Yii2-filemanager-widgets
========================
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
