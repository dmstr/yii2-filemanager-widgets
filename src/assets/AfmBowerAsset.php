<?php
/**
 * @link http://www.diemeisterei.de/
 * @copyright Copyright (c) 2016 diemeisterei GmbH, Stuttgart
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace hrzg\filemanager\assets;

use yii\web\AssetBundle;
use yii\web\View;

/**
 * Class AfmBowerAsset
 *
 * @package hrzg\filemanager\assets
 * @author Christopher Stebe <c.stebe@herzogkommunikation.de>
 */
class AfmBowerAsset extends AssetBundle
{
    public $sourcePath = __DIR__ . 'bower/angular';

    public $js = [
        'angular.min.js',
        'angular-sanitize.min.js',
        'angular-translate.min.js',
        'ng-file-upload.min.js',
        'clipboard.min.js',
        'ngclipboard.js',
    ];

    public $jsOptions = [
        'position' => View::POS_HEAD,
    ];

    public $depends = [
        'yii\bootstrap\BootstrapPluginAsset',
        'yii\web\YiiAsset'
    ];

}