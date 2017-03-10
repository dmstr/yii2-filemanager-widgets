<?php
/**
 * @link http://www.diemeisterei.de/
 * @copyright Copyright (c) 2017 diemeisterei GmbH, Stuttgart
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
namespace hrzg\filemanager\helpers;

use yii\helpers\Url as BaseUrl;

/**
 * Class Url
 * @package hrzg\filemanager\helpers
 * @author Christopher Stebe <c.stebe@herzogkommunikation.de>
 */
class Url
{
    /**
     * Route to filefly API
     * @var string
     */
    protected static $fileflyApiUrl = '/filefly/api';

    /**
     * Init globals
     */
    public function init()
    {
        $afmHandlerUrl = getenv('AFM_HANDLER_URL');

        if (!empty($afmHandlerUrl)) {
            self::$fileflyApiUrl = $afmHandlerUrl;
        }
    }

    /**
     * Returns the URL prefix to stream a file
     *
     * @return string
     */
    public static function streamFile($path)
    {
        return BaseUrl::to([self::$fileflyApiUrl, 'action' => 'stream', 'path' => $path]);
    }

    /**
     * Returns the URL prefix to download a file
     *
     * @return string
     */
    public static function downloadFile($path)
    {
        return BaseUrl::to([self::$fileflyApiUrl, 'action' => 'download', 'path' => $path]);
    }
}