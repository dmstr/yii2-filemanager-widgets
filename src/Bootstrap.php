<?php
/**
 * @link http://www.diemeisterei.de/
 * @copyright Copyright (c) 2016 diemeisterei GmbH, Stuttgart
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
namespace hrzg\filemanager;

use Yii;
use yii\base\BootstrapInterface;
use yii\i18n\PhpMessageSource;

/**
 * Class Bootstrap
 * @package hrzg\filemanager
 * @author Christopher Stebe <c.stebe@herzogkommunikation.de>
 */
class Bootstrap implements BootstrapInterface {

    /** @inheritdoc */
    public function bootstrap($app) {

        // Exact key, no trailing `*`: Yii matches a wildcard key as a prefix, so
        // `filemanager*` would also claim categories of the host application such
        // as `filemanager-custom`. All calls in this package use `filemanager`.
        if (!isset($app->get('i18n')->translations['filemanager'])) {
            $app->get('i18n')->translations['filemanager'] = [
                'class' => PhpMessageSource::className(),
                'basePath' => __DIR__ . '/messages',
                'sourceLanguage' => 'en-US'
            ];
        }
        
    }

}
