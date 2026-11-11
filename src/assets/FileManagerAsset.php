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
 * Publishes the compiled file manager bundle. Bootstrap 3 CSS including
 * Glyphicons is the only dependency and comes from the host application.
 *
 * @author Christopher Stebe <c.stebe@herzogkommunikation.de>
 */
class FileManagerAsset extends AssetBundle
{
    public $sourcePath = __DIR__ . '/dist';

    public $css = ['filemanager.css'];

    public $js = ['filemanager.js'];

    /**
     * Publish only the build output and its notice file, which the banner of
     * the two bundles points to, so stray files in the directory never reach
     * the web root.
     */
    public $publishOptions = [
        'only' => ['filemanager.css', 'filemanager.js', 'filemanager.licenses.txt'],
    ];

    public $depends = ['yii\bootstrap\BootstrapAsset'];

    /**
     * Places filemanager.js at the end of the body without declaring the
     * position in `$jsOptions`.
     *
     * View::registerAssetBundle() hands a declared position on to every
     * dependency and stores it on the bundle instances, which the asset
     * manager shares for its whole lifetime: a declared POS_END marks
     * BootstrapAsset as POS_END, and a bundle registered after it that
     * depends on Bootstrap with an earlier position (kartik's DialogAsset at
     * POS_HEAD) then fails with "has a higher javascript file position
     * configured". Applying the position only while the files are written
     * leaves the dependencies alone.
     *
     * A position that a depending bundle has set is kept. The bundle mounts
     * on DOMContentLoaded, so it also works from the head.
     *
     * @param \yii\web\View $view
     */
    public function registerAssetFiles($view)
    {
        $jsOptions = $this->jsOptions;
        if (!isset($this->jsOptions['position'])) {
            $this->jsOptions['position'] = View::POS_END;
        }
        try {
            parent::registerAssetFiles($view);
        } finally {
            $this->jsOptions = $jsOptions;
        }
    }
}
