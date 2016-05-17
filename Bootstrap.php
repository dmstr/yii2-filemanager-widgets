<?php
/**
 * @link http://www.diemeisterei.de/
 * @copyright Copyright (c) 2016 diemeisterei GmbH, Stuttgart
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
namespace hrzg\widget;

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

        
        if (!isset($app->get('i18n')->translations['afm*'])) {
            $app->get('i18n')->translations['afm*'] = [
                'class' => PhpMessageSource::className(),
                'basePath' => __DIR__ . '/messages',
                'sourceLanguage' => 'en-US'
            ];
        }
        
    }

}
