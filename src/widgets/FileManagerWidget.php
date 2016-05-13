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
 * File manager widget
 */
class FileManagerWidget extends BaseFileManagerWidget
{
    /**
     * @return string
     */
    public function run()
    {
        return $this->template;
    }
}
