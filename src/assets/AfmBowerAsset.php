<?php

namespace hrzg\filemanager\assets;

/**
 * @link http://www.diemeisterei.de/
 * @copyright Copyright (c) 2016 diemeisterei GmbH, Stuttgart
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

use yii\helpers\FileHelper;
use yii\web\AssetBundle;
use yii\web\View;

/**
 * Configuration for `AfmBowerAsset` client script files.
 */
class AfmBowerAsset extends AssetBundle
{
    public $sourcePath = '@bower';

    public $css = [
        'bootswatch/paper/bootstrap.min.css',
    ];

    public $js = [
        'angular/angular.min.js',
        'angular-translate/angular-translate.min.js',
        'ng-file-upload/ng-file-upload.min.js',
    ];

    public $jsOptions = [
        'position' => View::POS_HEAD,
    ];

    public $depends = [
        'yii\bootstrap\BootstrapPluginAsset',
        'yii\web\YiiAsset',
    ];

    public function init()
    {
        parent::init();

        // /!\ CSS/LESS development only setting /!\
        // Touch the asset folder with the highest mtime of all contained files
        // This will create a new folder in web/assets for every change and request
        // made to the app assets.
        if (getenv('APP_ASSET_FORCE_PUBLISH')) {
            $path   = \Yii::getAlias($this->sourcePath);
            $files  = FileHelper::findFiles($path);
            $mtimes = [];
            foreach ($files as $file) {
                $mtimes[] = filemtime($file);
            }
            touch($path, max($mtimes));
        }
    }
}