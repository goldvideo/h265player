/**
 * Copyright (C) 2019.
 * All Rights Reserved.
 * @file AlertError.js
 * @desc
 * display error with alert
 * @author Jarry
 */

// import Logger from '../toolkit/Logger.js'
import BaseController from '../base/BaseController'

class AlertError extends BaseController {
  component = null
  constructor(options) {
    super()
    this.component = options.component
  }

  confirm() {

  }

  show(msg = '') {
    this.component.data.content = msg
    if (this.component.data.display === 'default' || this.component.data.display === '') {
      this.component.showBox()
    }
    if (this.component.data.display !== 'show') {
      this.component.show()
    }
  }

  hide() {
    this.component.hide()
  }

}

export default AlertError