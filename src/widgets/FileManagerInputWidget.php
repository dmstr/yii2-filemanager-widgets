<?php
/**
 * @link http://www.diemeisterei.de/
 * @copyright Copyright (c) 2016 diemeisterei GmbH, Stuttgart
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace hrzg\filemanager\widgets;

use hrzg\filemanager\helpers\Url;
use kartik\select2\Select2;
use rmrevin\yii\fontawesome\FA;
use yii\helpers\Html;
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
     * Render a select2 dropdown list, that does an ajax call to the filefly api to find elements
     *
     * @return string
     * @throws \Exception
     */
    public function run()
    {
        $this->registerClientScript();

        // render select2 input widget
        return Select2::widget(
            [
                'model' => ($this->model) ? $this->model : null,
                'attribute' => ($this->attribute) ? $this->attribute : null,
                'name' => ($this->name) ? $this->name : null,
                'options' => [
                    'placeholder' => \Yii::t('afm', 'Search for a file ...'),
                ],
                'addon' => [
                    'append' => [
                        'content'  => Html::button(
                                FA::i('copy'),
                                ['class' => 'btn btn-default', 'data-input-id' => 'afm-copy-btn', 'disabled' => '1']
                            )
                            . Html::button(
                                FA::i('link'),
                                ['class' => 'btn btn-default', 'data-input-id' => 'afm-link-btn', 'disabled' => '1']
                            )
                            . Html::button(
                                FA::i('download'),
                                ['class' => 'btn btn-default', 'data-input-id' => 'afm-download-btn', 'disabled' => '1']
                            ),
                        'asButton' => true
                    ],
                ],
                'pluginOptions' => [
                    'allowClear' => true,
                    'minimumInputLength' => 3,
                    'language' => [
                        'errorLoading' =>  \Yii::t('afm', 'Waiting for results ...'),
                    ],
                    'ajax' => [
                        'url' => Url::to('search'),
                        'dataType' => 'json',
                        'delay' => 220,
                        'data' => new JsExpression('searchData'),
                        'processResults' => new JsExpression('resultJs'),
                        'cache' => true
                    ],
                    'escapeMarkup' => new JsExpression('escapeMarkup'),
                    'templateResult' => new JsExpression('formatFiles'),
                    'templateSelection' => new JsExpression('formatFileSelection'),
                ],
                'pluginEvents' => [
                    "select2:select" => new JsExpression('onSelect'),
                    "select2:unselect" => new JsExpression('onUnSelect'),
                ]
            ]
        );
    }

    /**
     * Register input scripts
     */
    protected function registerClientScript()
    {
        // the image preview url prefix
        $previewUrl = Url::to('stream');

        // format result markup and register addon button scripts and events
        $inputJs = <<<JS
var searchData = function(params) {
    return {q:params.term};
};
var formatFiles = function (file) {
        if (file.loading) {
            return file.text;
        }
        var markup =
            '<div class="row">' +
                '<div class="col-sm-2">' +
                    '<img src="{$previewUrl}' + file.id + '" style="width:64px" />' +
                '</div>' +
                '<div class="col-sm-10" style="word-wrap:break-word;">' + file.name + '</div>' +
            '</div>';
        return '<div style="overflow:hidden;">' + markup + '</div>';
};
var formatFileSelection = function (file, test) {
    if (!file.id && !file.name) {
        return file.text;
    }
    var title = file.id || file.name;
    return '<img src="{$previewUrl}' + file.id + '" style="width:24px;padding-right:5px;" /> ' + title;
};
var resultJs = function(data) {
    var response = [];
    for (var i=0;i < data.result.length; i++) {
        var path = data.result[i].path;
        response.push({id: path, name: path});
    }
    return {results: response};
};
var onSelect = function() {
    console.log("selected");
};
var onUnSelect = function() {
    console.log("unSelected");
};
var escapeMarkup = function(markup) {
    return markup;
};
JS;

        // Register the formatting script
        $this->view->registerJs($inputJs, View::POS_HEAD);
    }
}
