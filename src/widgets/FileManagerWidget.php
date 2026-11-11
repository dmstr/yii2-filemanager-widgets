<?php
/**
 * @link http://www.diemeisterei.de/
 * @copyright Copyright (c) 2016 diemeisterei GmbH, Stuttgart
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace hrzg\filemanager\widgets;

use hrzg\filemanager\assets\AfmAsset;
use yii\base\Widget;
use yii\helpers\ArrayHelper;
use yii\helpers\Json;
use yii\helpers\Url;
use yii\web\View;

/**
 * Class FileManagerWidget
 * File manager base widget, renders the mount point of the Vue 3 file manager
 * and hands the configuration to the bundle via `window.fileManagerConfig`
 *
 * @package hrzg\filemanager\widgets\base
 * @author Christopher Stebe <c.stebe@herzogkommunikation.de>
 */
class FileManagerWidget extends Widget
{
    /**
     * File Handler Url
     * @var null|string
     */
    public $handlerUrl;

    /**
     * @var string
     */
    public $title;

    /**
     * @var string
     */
    public $template = '<angular-filemanager></angular-filemanager>';

    /**
     * @var boolean|null
     */
    public $enableThumbnails;

    /**
     * @var boolean|null
     */
    public $enableIconPreviewView;

    /**
     * array of file manager options, merged over the defaults below and
     * passed to the bundle as `window.fileManagerConfig`
     *
     * @var null|array
     */
    public $options;

    /**
     * @inheritdoc
     */
    public function init()
    {
        // register assets
        AfmAsset::register(\Yii::$app->view);

        // Config filemanager
        $this->setFileManagerConfig();
    }

    /**
     * @return string
     */
    public function run()
    {
        return $this->template;
    }

    /**
     * Set handler url and publish the config to `window.fileManagerConfig`
     */
    protected function setFileManagerConfig()
    {
        // Set handler Url
        if ($this->handlerUrl === null) {
            $this->handlerUrl = Url::to([getenv('AFM_HANDLER_URL')]);
        }

        // check if user is allowed to change permissions
        $allowPermissions = false;
        if (!\Yii::$app->user->isGuest && \Yii::$app->user->can('FileflyPermissions')) {
            $allowPermissions = true;
        }

        $title             = empty($this->title) ? getenv('AFM_TITLE') : $this->title;
        $lang              = \Yii::$app->language;

        $this->options = is_array($this->options) ? $this->options : [];

        $defaults = [
            'appName' => $title,
            'defaultLang' => $lang,
            // which functions should be activated in fileManagerApp?
            'searchForm' => true,
            'sidebar' => true,
            'breadcrumb' => true,
            'hidePermissions' => true,

            // Handler Urls
            'listUrl' => $this->handlerUrl,
            'uploadUrl' => $this->handlerUrl,
            'renameUrl' => $this->handlerUrl,
            'copyUrl' => $this->handlerUrl,
            'moveUrl' => $this->handlerUrl,
            'removeUrl' => $this->handlerUrl,
            'getContentUrl' => $this->handlerUrl,
            'createFolderUrl' => $this->handlerUrl,
            'downloadFileUrl' => $this->handlerUrl,
            'downloadMultipleUrl' => $this->handlerUrl,
            'compressUrl' => $this->handlerUrl,
            'extractUrl' => $this->handlerUrl,
            'permissionsUrl' => $this->handlerUrl,

            // Additional settings
            'multipleDownloadFileName' => 'filemanager.zip',
            'showSizeForDirectories' => false,
            'useBinarySizePrefixes' => false,
            'downloadFilesByAjax' => true,
            'previewImagesInModal' => true,
            'enablePermissionsRecursive' => false,
            'enableThumbnails' => false,
            'enableIconPreviewView' => false,

            // File patterns
            'isEditableFilePattern' => '/\.(!)/i',
            'isImageFilePattern' => '/\.(jpe?g|gif|bmp|png|svg|tiff?)$/i',
            'isExtractableFilePattern' => '/\.(gz|tar|rar|g?zip)$/i',
            // define allowed actions for filemanager
            'allowedActions' => [
                'upload' => true,
                'rename' => false,
                'move' => true,
                'copy' => true,
                'edit' => true,
                'compress' => true,
                'compressChooseName' => true,
                'extract' => true,
                'download' => true,
                'downloadMultiple' => true,
                'downloadLink' => true,
                'preview' => true,
                'remove' => true,
                'createFolder' => true,
                'pickFiles' => false,
                'pickFolders' => false,
                'changePermissions' => $allowPermissions,
                'customFileActions' => false,
                'customDirActions' => false,
            ]
        ];

        $config = ArrayHelper::merge($defaults, $this->options);

        // The three pattern options (isEditableFilePattern, isImageFilePattern,
        // isExtractableFilePattern) travel as plain JSON strings in regular
        // expression literal notation, the bundle converts them to RegExp.
        $json = Json::htmlEncode($config);

        // Deep merge into an existing window.fileManagerConfig: keys a host
        // script set earlier survive unless PHP sets the same key, PHP wins.
        $js = <<<JS
(function (win, php) {
    function isPlain(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }
    function merge(target, source) {
        Object.keys(source).forEach(function (key) {
            if (isPlain(source[key]) && isPlain(target[key])) {
                merge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        });
        return target;
    }
    win.fileManagerConfig = merge(win.fileManagerConfig || {}, php);
})(window, $json);
JS;

        // POS_HEAD inline code runs before the bundle, which AfmAsset loads at POS_END.
        // The key keeps a second widget on the same page from emitting it again.
        \Yii::$app->view->registerJs($js, View::POS_HEAD, 'afm-file-manager-config');
    }
}
