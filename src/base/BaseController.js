/**
 * @copyright: Copyright (C) 2019
 * @desc: entry and dispatch of module
 * @author: Jarry
 * @file: BaseController.js
 */

import Logger from '../toolkit/Logger'
import getEvents from '../toolkit/Events'
class BaseController {
  logger = null
  __instance__ = null
  __singleton__ = null
  constructor(options = {}) {
    this.options = options
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

  toString() {
    return JSON.stringify(this)
  }

  static getInstance(...args) {
    this.__instance__ = new this(...args)
    return this.__instance__
  }
  static getSingleton(...args) {
    if (!this.__singleton__) {
      this.__singleton__ = new this(...args)
    }
    return this.__singleton__
  }
}

export default BaseController