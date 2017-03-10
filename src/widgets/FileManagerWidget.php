<?php
/**
 * @link http://www.diemeisterei.de/
 * @copyright Copyright (c) 2016 diemeisterei GmbH, Stuttgart
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace hrzg\filemanager\widgets;

use hrzg\filemanager\widgets\base\BaseFileManagerWidget;


/**
 * CLass FileManagerWidget
 * File manager widget
 *
 * @package hrzg\filemanager\widgets
 * @author Christopher Stebe <c.stebe@herzogkommunikation.de>
 */
class FileManagerWidget extends BaseFileManagerWidget
{
    /**
     * File Handler Url
     * @var null|string
     */
    public $handlerUrl = null;

    /**
     * @var string
     */
    public $title = 'My Filemanager';

    /**
     * @var string
     */
    public $template = "<div data-ng-app=\"FileManagerApp\"><div class=\"ng-cloak\"><angular-filemanager></angular-filemanager></div></div>";

    /**
     * @return string
     */
    public function run()
    {
        return $this->template;
    }
}
