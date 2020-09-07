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
use yii\helpers\Url;
use yii\web\View;

/**
 * Class FileManagerWidget
 * File manager base widget
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
    public $template = '<div data-ng-app="FileManagerApp"><div class="ng-cloak"><angular-filemanager></angular-filemanager></div></div>';

    /**
     * @var string
     */
    public $thumbnailUrlPrefix;

    /**
     * @var string
     */
    public $thumbnailUrlSuffix;

    /**
     * @var boolean
     */
    public $enableThumbnails;

    /**
     * @var boolean
     */
    public $enableIconPreviewView;
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
     * Set handler url and init angular module config
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
        $initFilemanagerJs = <<<JS
angular.module('FileManagerApp').config(['fileManagerConfigProvider', function (config) {
    var defaults = config.\$get();
    var handler = '$this->handlerUrl';
    config.set({

        // Application
        appName: '$title',
        defaultLang: '$lang',
        searchForm: true,
        sidebar: true,
        breadcrumb: true,
        hidePermissions: true,

        // Allowed actions
        allowedActions: angular.extend(defaults.allowedActions, {
            remove: true,
            list: true,
            move: true,
            rename: true,
            copy: true,
            download: true,
            downloadMultiple: false,
            downloadLink: true,
            changePermissions: '$allowPermissions',
            compress: false,
            compressChooseName: false,
            extract: false,
            upload: true
        }),

        // Handler
        listUrl: handler,
        uploadUrl: handler,
        renameUrl: handler,
        copyUrl: handler,
        moveUrl: handler,
        removeUrl: handler,
        getContentUrl: handler,
        createFolderUrl: handler,
        downloadFileUrl: handler,
        downloadMultipleUrl: handler,
        compressUrl: handler,
        extractUrl: handler,
        permissionsUrl: handler,

        // Additional settings
        multipleDownloadFileName: 'filemanager.zip',
        showSizeForDirectories: false,
        useBinarySizePrefixes: false,
        downloadFilesByAjax: true,
        previewImagesInModal: true,
        enablePermissionsRecursive: false,
        thumbnailUrlPrefix: '{$this->thumbnailUrlPrefix}',
        thumbnailUrlSuffix: '{$this->thumbnailUrlSuffix}',
        enableThumbnails: {$this->enableThumbnails},
        enableIconPreviewView: {$this->enableIconPreviewView},

        // File patterns
        isEditableFilePattern: /\.(!)/i,
        isImageFilePattern: /\.(jpe?g|gif|bmp|png|svg|tiff?)$/i,
        isExtractableFilePattern: /\.(gz|tar|rar|g?zip)$/i
        //tplPath: 'src/templates'
    });
}]);
JS;

        // Register
        \Yii::$app->view->registerJs(
            $initFilemanagerJs,
            View::POS_HEAD
        );
    }
}
