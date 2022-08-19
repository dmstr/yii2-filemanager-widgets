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
     * @var boolean|null
     */
    public $enableThumbnails;

    /**
     * @var boolean|null
     */
    public $enableIconPreviewView;

    /**
     * array of angular fileManagerApp options
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
            ]
        ];

        // these options are regEx and therefor can not be stored as strings in json
        // if preset, they will be handled later, see search/replace
        $specialOpts = [
            'isEditableFilePattern',
            'isImageFilePattern',
            'isExtractableFilePattern'
        ];
        // store specialOpts for replacement
        $specialValues = [];

        $config = ArrayHelper::merge($defaults, $this->options);

        // now insert placeholders for $specialValues that can not be stored as strings, e.g. regexP
        foreach ($specialOpts as $opt) {
            if (!empty($config[$opt])) {
                $specialValues[$opt] = [
                    'value' => $config[$opt],
                    'placeholder' => '###' . strtoupper($opt) . '###',
                ];
                $config[$opt] = $specialValues[$opt]['placeholder'];
            }
        }
        // generate config json
        $configJson = json_encode($config);
        // then replace placeholder strings in json config that can/should not be strings...
        foreach ($specialValues as $special) {
            $configJson = str_replace('"' . $special['placeholder']. '"', $special['value'], $configJson);
        }

        // finally create JS to init fileManagerApp
        $initFilemanagerJs = <<<JS
angular.module('FileManagerApp').config(['fileManagerConfigProvider', function (config) {
    var defaults = config.\$get();
    // we use merge here to get deep.copy, see: https://docs.angularjs.org/api/ng/function/angular.merge
    config.set(angular.merge(defaults, $configJson));
}]);
JS;

        // Register
        \Yii::$app->view->registerJs(
            $initFilemanagerJs,
            View::POS_HEAD
        );
    }
}
