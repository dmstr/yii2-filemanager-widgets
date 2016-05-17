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
 * @author Christopher Stebe <c.stebe@herzogkommunikation.de>
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
