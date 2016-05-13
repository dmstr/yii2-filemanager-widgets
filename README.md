Yii2-filemanager-widgets
========================
A very smart filemanager to manage your files in the browser developed in AngularJS with Material-Design

Installation
------------

The preferred way to install this extension is through [composer](http://getcomposer.org/download/).

Either run

```
php composer.phar require --prefer-dist hrzg/yii2-filemanager-widgets "*"
```

or add

```
"hrzg/yii2-filemanager-widgets": "*"
```

to the require section of your `composer.json` file.


Usage
-----

Once the extension is installed, simply use it in your code by  :

```php
<?= \hrzg\filemanager\widgets\FileManagerWidget::widget(); ?>```