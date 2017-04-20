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
        'clipboard/dist/clipboard.min.js',
        'ngclipboard/dist/ngclipboard.js',
    ];

    public $publishOptions = [
        'only' => [
            'angular/*',
            'angular-sanitize/*',
            'angular-translate/*',
            'ng-file-upload/*',
            'clipboard/dist/*',
            'ngclipboard/dist/*',
        ]
    ];

    public $jsOptions = [
        'position' => View::POS_HEAD,
    ];

    public $depends = [
        'yii\bootstrap\BootstrapPluginAsset',
        'yii\web\YiiAsset',
    ];

}