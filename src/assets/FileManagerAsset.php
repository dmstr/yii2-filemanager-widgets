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
     * End of body: Yii renders the script files of a position before its inline
     * code, so only POS_END guarantees that the config FileManagerWidget writes
     * at POS_HEAD exists when the bundle runs.
     */
    public $jsOptions = ['position' => View::POS_END];

    /**
     * Publish only the build output and its notice file, which the banner of
     * the two bundles points to, so stray files in the directory never reach
     * the web root.
     */
    public $publishOptions = [
        'only' => ['filemanager.css', 'filemanager.js', 'filemanager.licenses.txt'],
    ];

    public $depends = ['yii\bootstrap\BootstrapAsset'];
}
