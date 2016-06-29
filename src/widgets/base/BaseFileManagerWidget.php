<?php
/**
 * @link http://www.diemeisterei.de/
 * @copyright Copyright (c) 2016 diemeisterei GmbH, Stuttgart
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace hrzg\filemanager\widgets\base;

use hrzg\filemanager\assets\AfmAsset;
use yii\helpers\Url;
use yii\web\View;

/**
 * Class BaseFileManagerWidget
 * File manager base widget
 *
 * @package hrzg\filemanager\widgets\base
 * @author Christopher Stebe <c.stebe@herzogkommunikation.de>
 */
class BaseFileManagerWidget extends \yii\base\Widget
{
    /**
     * File Handler Url
     * @var null|string
     */
    public $handlerUrl = null;

    /**
     * @var string
     */
    public $title = 'Angular-Filemanager';

    /**
     * @var string
     */
    public $template = "<div data-ng-app=\"FileManagerApp\"><div class=\"ng-cloak\"><angular-filemanager></angular-filemanager></div></div>";

    /**
     * @inheritdoc
     */
    public function init()
    {
        // register assets
        AfmAsset::register(\Yii::$app->view);

        // Config filemanager
        $this->setFilemanagerConfig();
    }

    /**
     * Set handler url and init angular module config
     */
    protected function setFilemanagerConfig()
    {
        // Set handler Url
        if ($this->handlerUrl === null) {
            $this->handlerUrl = Url::to([getenv('AFM_HANDLER_URL')]);
        }

        // check if user is alloed to change permissions
        if (!\Yii::$app->user->isGuest && \Yii::$app->user->can('FileflyPermissions')) {
            $allowPermissions = true;
        } else {
            $allowPermissions = false;
        }

        $title             = getenv('AFM_TITLE') ? getenv('AFM_TITLE') : 'Angular-Filemanager';
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
            edit: true,
            download: true,
            downloadMultiple: true,
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
        editUrl: handler,
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

        // File patterns
        isEditableFilePattern: /\.(txt|diff?|patch|svg|asc|cnf|cfg|conf|html?|.html|cfm|cgi|aspx?|ini|pl|py|md|css|cs|js|jsp|log|htaccess|htpasswd|gitignore|gitattributes|env|json|atom|eml|rss|markdown|sql|xml|xslt?|sh|rb|as|bat|cmd|cob|for|ftn|frm|frx|inc|lisp|scm|coffee|php[3-6]?|java|c|cbl|go|h|scala|vb|tmpl|lock|go|yml|yaml|tsv|lst)$/i,
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
