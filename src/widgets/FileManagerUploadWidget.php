<?php
/**
 * @link http://www.diemeisterei.de/
 * @copyright Copyright (c) 2016 diemeisterei GmbH, Stuttgart
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace hrzg\filemanager\widgets;

use yii\helpers\Html;
use yii\widgets\InputWidget;
use yii\web\UploadedFile;

/**
 * Class FileManagerUploadWidget
 * @package hrzg\filemanager\widgets
 * @author René Lantzsch <r.lantzsch@herzogkommunikation.de>
 */
class FileManagerUploadWidget extends InputWidget
{
    /**
     * @var string
     */
    public $uploadPath = '/';

    /**
     * @var string
     */
    public $renameTo;

    /**
     * @var string
     */
    public $template = '';

    /**
     * @var array $options
     */
    public $options = [];

    /**
     * @return string
     */
    public function run()
    {
        parent::run();

        $this->template = Html::activeFileInput($this->model, $this->attribute, $this->options);

        $file = UploadedFile::getInstance($this->model, $this->attribute);

        if ($file && $file->error === UPLOAD_ERR_OK) {
            $stream = fopen($file->tempName, 'r+');

            $filename = ($this->renameTo) ? ($this->renameTo . '.' . $file->extension) : $file->name;
            $uploadPath = rtrim($this->uploadPath, '/') . '/' . $filename;
            $result = \Yii::$app->fs->putStream($uploadPath, $stream);

            fclose($stream);
        }

        return $this->template;
    }
}
