/**
 * Copyright (C) 2019.
 * All Rights Reserved.
 * @file ThrowError.js
 * @desc
 * display error with throw
 * @author Jarry
 */

import {
  Config
} from '../config/Config.js';

const ERROR_TYPE = {
  eval: EvalError,
  range: RangeError,
  reference: ReferenceError,
  syntax: SyntaxError,
  type: TypeError,
  uri: URIError,
  default: Error
}
class ThrowError {
  type = ''
  errorName = 'DefaultError'
  code = null
  message = ''
  stack = ''

  constructor(type = 'default', code = 1001) {
    this.type = type
    this.code = code
    return this.throws.bind(this)
  }
  /**
   * throw error by type
   * @param {Error|string} e | message
   * @param  {...any} args 
   */
  throws(e, ...args) {
    let message = ''
    let Instance = Error
    if (e instanceof Error) {
      for (let type in ERROR_TYPE) {
        if (e instanceof ERROR_TYPE[type]) {
          this.errorName = ERROR_TYPE[type].name
          Instance = e.constructor
          break
        }
      }
      this.stack = e.stack
      if (args && args.splice) {
        message = args[0]
        args.splice(0, 1)
      }
    } else {
      message = e.toString()
    }
    this.message = `[${Config.projectName} ERROR:` + this.type + `-` + this.code + `]` + message
    try {
      throw new Instance(this.message, '[args]:', args)
    } catch (e) {
      this.stack = this.stack || e.stack
      console.error(e, '[message]:', message, '[args]:', args)
    }
  }
}

let instance = null
const throwError = (function () {
  if (!instance) {
    instance = new ThrowError()
  }
  return instance
})()

export {
  throwError,
  ThrowError
}