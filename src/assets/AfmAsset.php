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
class AfmAsset extends AssetBundle
{
    public $sourcePath = '@vendor/hrzg/yii2-filemanager-widgets/src/assets/dist';

    public static $assetSourcePath = null;

    public $css = [
        'angular-filemanager.min.css',
    ];

    public $js = [
        'angular-filemanager.min.js',
    ];

    public $jsOptions = [
        'position' => View::POS_HEAD,
    ];

    public $depends = [
        'yii\bootstrap\BootstrapPluginAsset',
        'yii\web\YiiAsset',
        'hrzg\filemanager\assets\AfmBowerAsset',
    ];

    public function init()
    {
        parent::init();

        self::$assetSourcePath = $this->sourcePath;

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

    /**
     * @return false|string
     */
    public static function getPublishedUrl()
    {
        return \Yii::$app->assetManager->getPublishedUrl(self::$assetSourcePath);
    }
}