/**
 * @copyright: Copyright (C) 2019
 * @desc: entry and dispatch of module
 * @author: Jarry
 * @file: BaseController.js
 */

import BaseClass from './BaseClass'

class BaseController extends BaseClass {
  constructor(options = {}) {
    super(options)
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
