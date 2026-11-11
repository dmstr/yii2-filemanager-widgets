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
 * Class FileManagerAsset
 * Publishes the compiled Vue 3 file manager (filemanager.css and filemanager.js).
 * Bootstrap 3 CSS incl. Glyphicons is the only dependency, it comes from the host application.
 * @package hrzg\filemanager\assets
 * @author Christopher Stebe <c.stebe@herzogkommunikation.de>
 */
class FileManagerAsset extends AssetBundle
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
        'filemanager.css',
    ];

    /**
     * @var array
     */
    public $js = [
        'filemanager.js',
    ];

    /**
     * The bundle goes to the end of the body: inline code of a position renders after
     * the script files of the same position, so only POS_END guarantees that the
     * config FileManagerWidget writes at POS_HEAD exists when the bundle runs.
     * The bundle mounts itself on DOMContentLoaded.
     *
     * @var array
     */
    public $jsOptions = [
        'position' => View::POS_END,
    ];

    /**
     * @var array $publishOptions
     */
    public $publishOptions = [
        'forceCopy' => false,
        // keep the legacy AngularJS files and LESS sources out of the web root
        'only' => ['filemanager.css', 'filemanager.js'],
    ];

    /**
     * @var array
     */
    public $depends = [
        'yii\bootstrap\BootstrapAsset',
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