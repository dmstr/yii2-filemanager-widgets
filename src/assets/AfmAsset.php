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
 * Class AfmAsset
 * @package hrzg\filemanager\assets
 * @author Christopher Stebe <c.stebe@herzogkommunikation.de>
 */
class AfmAsset extends AssetBundle
{
    /**
     * @var string
     */
    public $sourcePath = '@hrzg/filemanager/assets/dist';

    /**
     * @var string|null
     */
    public static $assetSourcePath = null;

    /**
     * @var array
     */
    public $css = [
        'angular-filemanager-scoped.less',
        'angular-filemanager-custom.less'
    ];

    /**
     * @var array
     */
    public $js = [
        'angular-filemanager.min.js',
    ];

    /**
     * @var array
     */
    public $jsOptions = [
        'position' => View::POS_HEAD,
    ];

    /**
     * @var array $publishOptions
     */
    public $publishOptions = [
        'forceCopy' => false,
    ];

    /**
     * @var array
     */
    public $depends = [
        'yii\bootstrap\BootstrapPluginAsset',
        'yii\web\YiiAsset',
        'hrzg\filemanager\assets\AfmBowerAsset',
    ];

    /**
     * @inheritdoc
     */
    public function init()
    {
        parent::init();

        self::$assetSourcePath = $this->sourcePath;
    }

    /**
     * @return false|string
     */
    public static function getPublishedUrl()
    {
        return \Yii::$app->assetManager->getPublishedUrl(self::$assetSourcePath);
    }
}