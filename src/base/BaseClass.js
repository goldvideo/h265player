/**
 * @copyright: Copyright (C) 2019
 * @desc: base class of all service
 * @author: Jarry
 * @file: BaseClass.js
 */

import Logger from '../toolkit/Logger'
import getEvents from '../toolkit/Events'
class BaseClass {
  logger = null
  constructor(options = {}) {
    this.options = options
    this.debug = options.debug || false
    this.setLogger(this.constructor.name + '.js')
  }
  
  setLogger(file) {
    this.logger = new Logger(file)
  }

  getLogger() {
    return this.logger
  }

  setOptions(options) {
    Object.assign(this.options, options)
  }
  
  get events() {
    if (this.options && this.options.events) {
      return this.options.events(this)
    }
    return getEvents(this)
  }
  get alert() {
    let res = ''
    if (this.options && this.options.alertError) {
      res = this.options.alertError
    }
    return res
  }

  toString() {
    return JSON.stringify(this)
  }
}

export default BaseClass