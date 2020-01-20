/**
 * @copyright: Copyright (C) 2019
 * @desc: SettingBar
 * @author: Jarry
 * @file: SettingBar.js
 */

import BaseComponent from '../../base/BaseComponent'

class SettingBar extends BaseComponent {
  template = this.createTemplate`
  <gp-setting class="goldplay__setting-bar">
  </gp-setting>
  `
  options = {}
  constructor(options = {}) {
    super(options)
    this.options = options
    Object.assign(this.data, options.data)
    this.init()
  }

}

export default SettingBar