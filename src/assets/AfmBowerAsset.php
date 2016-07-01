<?php
/**
 * @link http://www.diemeisterei.de/
 * @copyright Copyright (c) 2016 diemeisterei GmbH, Stuttgart
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
namespace hrzg\filemanager\assets;

use yii\helpers\FileHelper;
use yii\web\AssetBundle;
use yii\web\View;

/**
 * Class AfmBowerAsset
 * @package hrzg\filemanager\assets
 * @author Christopher Stebe <c.stebe@herzogkommunikation.de>
 */
class AfmBowerAsset extends AssetBundle
{
    public $sourcePath = '@bower';

    public $css = [];

    public $js = [
        'angular/angular.min.js',
        'angular-sanitize/angular-sanitize.min.js',
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