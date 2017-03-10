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
     * render a select2 dropdown list, that do an ajax call to the filefly api to find images
     *
     * @return string
     * @throws \Exception
     */
    public function run()
    {
        // the filefly api request url to search files
        $ajaxUrl = Url::to([getenv('AFM_HANDLER_URL'), 'action' => 'search']);

        // the image preview url prefix
        $previewUrl = Url::to([getenv('AFM_HANDLER_URL'), 'action' => 'stream', 'path' => '']);

        // format result markup
        $formatJs = <<<JS

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

var formatFileSelection = function (file) {
    return file.name;
}
JS;

        // Register the formatting script
        $this->view->registerJs($formatJs, View::POS_HEAD);

        // script to parse the results into the expected format
        $resultsJs = <<<JS
function(data) {
    var response = [];
    for (var i=0;i < data.result.length; i++) {
        var path = data.result[i].path;
        response.push({id: path, name: path});
    }
    return {results: response};
}
JS;

        return Select2::widget(
            [
                'model' => ($this->model) ? $this->model : null,
                'attribute' => ($this->attribute) ? $this->attribute : null,
                'name' => ($this->name) ? $this->name : null,
                'options' => [
                    'placeholder' => \Yii::t('afm', 'Search for a file ...'),
                ],
                'addon' => [
                    'prepend' => [
                        'content' => \Yii::t('afm', 'Browse')
                    ],
                ],
                'pluginOptions' => [
                    'allowClear' => true,
                    'minimumInputLength' => 3,
                    'language' => [
                        'errorLoading' =>  \Yii::t('afm', 'Waiting for results ...'),
                    ],
                    'ajax' => [
                        'url' => $ajaxUrl,
                        'dataType' => 'json',
                        'delay' => 300,
                        'data' => new JsExpression('function(params) { return {q:params.term}; }'),
                        'processResults' => new JsExpression($resultsJs),
                        'cache' => true
                    ],
                    'escapeMarkup' => new JsExpression('function (markup) { return markup; }'),
                    'templateResult' => new JsExpression('formatFiles'),
                    'templateSelection' => new JsExpression('formatFileSelection'),
                ],
            ]
        );
    }
}
