<?php
/**
 * @link http://www.diemeisterei.de/
 * @copyright Copyright (c) 2016 diemeisterei GmbH, Stuttgart
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace hrzg\filemanager\widgets;

use kartik\select2\Select2;
use rmrevin\yii\fontawesome\FA;
use yii\base\Exception;
use yii\helpers\BaseUrl;
use yii\helpers\Html;
use yii\helpers\Url;
use yii\web\JsExpression;
use yii\web\View;
use yii\widgets\InputWidget;

/**
 * Class FileManagerInputWidget
 * @package hrzg\filemanager\widgets
 * @author Christopher Stebe <c.stebe@herzogkommunikation.de>
 */
class FileManagerInputWidget extends InputWidget
{
    /**
     * File Handler Url
     * @var null|string
     */
    public $handlerUrl;

    /**
     * @var array
     */
    public $select2Options = [];

    public function init()
    {
        parent::init();

        if (empty($this->handlerUrl)) {
            throw new Exception('Missing handlerUrl confiugration');
        }

        if ($this->hasModel()) {
            $this->select2Options['model'] = $this->model;
            $this->select2Options['attribute'] = $this->attribute;
        } else {
            $this->select2Options['name'] = $this->name;
        }

        $this->select2Options['options'] = [
            'id' => $this->options['id'],
            'placeholder' => \Yii::t('afm', 'Search for a file ...'),
            'style' => ['width' => '100%']
        ];

        $this->select2Options['addon'] = $this->generateAddonButtons();

        $this->select2Options['pluginOptions'] = [
            'allowClear'         => true,
            'minimumInputLength' => 3,
            'language'           => [
                'errorLoading' => \Yii::t('afm', 'Waiting for results ...'),
            ],
            'ajax'               => [
                'cache'          => true,
                'url'            => $this->to('search', null),
                'dataType'       => 'json',
                'delay'          => 220,
                'data'           => new JsExpression('searchData'),
                'processResults' => new JsExpression('resultJs'),
            ],
            'escapeMarkup'       => new JsExpression('escapeMarkup'),
            'templateResult'     => new JsExpression('formatFiles'),
            'templateSelection'  => new JsExpression('formatFileSelection'),
            'width' => '100%'
        ];

        $this->select2Options['pluginEvents'] = [
            "select2:select"   => new JsExpression('onSelect'),
            "select2:unselect" => new JsExpression('onUnSelect'),
        ];
    }

    /**
     * Render a select2 dropdown list, that does an ajax call to the filefly api to find elements
     *
     * @return string
     * @throws \Exception
     */
    public function run()
    {
        $this->registerClientScript();
        // render select2 input widget
        return Select2::widget($this->select2Options);
    }

    /**
     * Register input scripts
     */
    protected function registerClientScript()
    {
        // the input id
        $inputId = $this->options['id'];

        // the filefly api search url prefix
        $searchUrl = $this->to('search');

        // the image preview url prefix
        $previewUrl = $this->to('stream');

        // the file download url prefix
        $downloadUrl = $this->to('download');

        // initial handling for input widget
        $initJs = <<<JS
// init
$('#{$inputId}').ready(function(){
    var selectedPath = $('#{$inputId} option:selected').val();
    if (selectedPath) {
        $.ajax({
            cache:true,
            url: "{$searchUrl}",
            dataType:"json",
            delay:220,
            data: {q: selectedPath},
            success: function(result){
                if (result.length == 1) {
                    onSelect(result[0], '{$inputId}');
                }
            }
        });
    }
});
JS;

        $this->view->registerJs($initJs, View::POS_READY);

        // format result markup and register addon button scripts and events
        $inputJs = <<<JS
var searchData = function(params) {
    return {q:params.term};
};
var formatFiles = function (file) {

    // show loading / placeholder
    if (file.loading) {
        return file.text;
    }

    // mime types
    var preview = '';
    var text = file.path;
    if (file.mime.indexOf("image") > -1) {
        preview = '<img src="{$previewUrl}' + file.id + '" style="width:38px" />';
    } else if (file.mime.indexOf("directory") > -1) {
        preview = '<span style="width:40px"><i class="fa fa-folder-open fa-3x"></i></span>';
    } else if (file.mime.indexOf("pdf") > -1) {
        preview = '<span style="width:40px"><i class="fa fa-file-pdf-o fa-3x"></i></span>';
    } else if (file.mime.indexOf("zip") > -1) {
        preview = '<span style="width:40px"><i class="fa fa-file-zip-o fa-3x"></i></span>';
    } else if (file.mime.indexOf("doc") > -1) {
        preview = '<span style="width:40px"><i class="fa fa-file-word-o fa-3x"></i></span>';
    } else if (file.mime.indexOf("xls") > -1) {
        preview = '<span style="width:40px"><i class="fa fa-file-excel-o fa-3x"></i></span>';
    } else if (file.mime.indexOf("ppt") > -1) {
        preview = '<span style="width:40px"><i class="fa fa-file-powerpoint-o fa-3x"></i></span>';
    } else {
        preview = '<span style="width:40px"><i class="fa fa-file-o fa-3x"></i></span>';
    }

    // one result line markup
    var markup =
        '<div class="row" style="min-height:38px">' +
            '<div class="col-sm-2">' + preview + '</div>' +
            '<div class="col-sm-10" style="word-wrap:break-word;">' + text + '</div>' +
         '</div>';

    return '<div style="overflow:hidden;">' + markup + '</div>';
};
var formatFileSelection = function (file) {
    if (!file.id && !file.path) {
        return file.text;
    }
    return file.id || file.path;
};
var resultJs = function(data) {
    return {results: data};
};
var onSelect = function(elem, initId) {
    var elementId = '';
    var path = '';
    var mime = '';

    if (initId) {
        elementId = initId;
        path = elem.path;
        mime = elem.mime;
    } else {
        elementId = elem.currentTarget.id;
        path = elem.params.data.id;
        mime = elem.params.data.mime;
    }

    // button elements
    var copyBtn = $('#' + elementId + '-afm-copy-btn');
    var linkBtn = $('#' + elementId + '-afm-link-btn');
    var downloadBtn = $('#' + elementId + '-afm-download-btn');

    // enable buttons
    copyBtn.prop('disabled', false);
    copyBtn.on('click', function() {
        copyToClipboard(path);
    });

    // enable link and download only for files
    if (! mime.indexOf("directory") > -1) {
        linkBtn.prop('disabled', false);
        linkBtn.on('click', function() {
            copyToClipboard('{$previewUrl}' + path);
        });
        downloadBtn.prop('disabled', false);
        downloadBtn.on('click', function() {
            window.location.href = '{$downloadUrl}' + path;
        });
    }
};
var onUnSelect = function(elem) {
    var elementId = elem.currentTarget.id;

    // button elements
    var copyBtn = $('#' + elementId + '-afm-copy-btn');
    var linkBtn = $('#' + elementId + '-afm-link-btn');
    var downloadBtn = $('#' + elementId + '-afm-download-btn');

    // disable buttons
    copyBtn.prop('disabled', true);
    linkBtn.prop('disabled', true);
    downloadBtn.prop('disabled', true);
};
var escapeMarkup = function(markup) {
    return markup;
};
var copyToClipboard = function (str) {
  var temp = $("<input>");
  $("body").append(temp);
  temp.val(str).select();
  document.execCommand("copy");
  temp.remove();
};
JS;
        // Register the input widget handler script
        $this->view->registerJs($inputJs, View::POS_HEAD);
    }

    /**
     * Generate the select input field link buttons
     *  - copy
     *  - link
     *  - download
     *
     * @return array
     */
    protected function generateAddonButtons()
    {
        return [
            'append' => [
                'content'  => Html::button(
                        FA::i(FA::_COPY),
                        [
                            'class'    => 'btn btn-default',
                            'id'       => $this->options['id'] . '-afm-copy-btn',
                            'disabled' => 'disabled',
                            'title'    => \Yii::t('afm', 'Copy path to clipboard')
                        ]
                    )
                    . Html::button(
                        FA::i(FA::_LINK),
                        [
                            'class'    => 'btn btn-default',
                            'id'       => $this->options['id'] . '-afm-link-btn',
                            'disabled' => 'disabled',
                            'title'    => \Yii::t('afm', 'Copy link to clipboard')
                        ]
                    )
                    . Html::button(
                        FA::i(FA::_DOWNLOAD),
                        [
                            'class'    => 'btn btn-default',
                            'id'       => $this->options['id'] . '-afm-download-btn',
                            'disabled' => 'disabled',
                            'title'    => \Yii::t('afm', 'Download file')
                        ]
                    ),
                'asButton' => true
            ]
        ];
    }


    /**
     * Returns the URL prefix for a getHandler action
     *
     * @param string $action
     * @param string $path
     *
     * @return string
     */
    private function to($action, $path = '')
    {
        return Url::to([$this->handlerUrl, 'action' => $action, 'path' => $path]);
    }
}
