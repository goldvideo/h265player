/**
 * @copyright: Copyright (C) 2019
 * @desc: SubtitleBar
 * @author: Jarry
 * @file: Subtitle.js
 */

import BaseComponent from '../../base/BaseComponent'

class Subtitle extends BaseComponent {
  template = this.createTemplate`
  <gp-subtitle class="goldplay__subtitle">
  </gp-subtitle>
  `
  options = {}
  constructor(options = {}) {
    super(options)
    this.options = options
    Object.assign(this.data, options.data)
    this.init()
  }

}

export default Subtitle