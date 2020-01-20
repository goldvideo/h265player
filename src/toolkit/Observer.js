/**
 * Copyright (C) 2019.
 * All Rights Reserved.
 * @file Observer.js
 * @desc
 * Watching and listening data changing, trigger render event immediately
 * @author Jarry
 */
import Logger from './Logger.js'

let logger = Logger.get('Observer.js')

export class Observer {
  object = null
  constructor(object) {
    this.setObject(object)
  }

  setObject(object) {
    this.object = object
  }

  async watch (obj, prop, value) {
    const object = this.object
    if (typeof object.watch !== 'function') {
      return
    }
    const result = await object.watch(obj, prop, value)
    if (result !== false && typeof object.render === 'function') {
      object.render(obj, prop, value)
    }
    if (typeof object.afterWatch === 'function') {
      object.afterWatch(obj, prop, value)
    }
  }

  /**
   * create a watcher by proxy for object
   * @param {Object} [target] listen data object
   * @param {Object} [{ set, get }] 
   */
  create(target, options = {}) {
    const self = this
    const set = options.set
    const get = options.get
    target = target || self.data
    const object = self.object
    const handle = {
      set(obj, prop, value) {
        if (typeof set === 'function') {
          return set.call(self, obj, prop, value)
        }
        if (obj[prop] !== value) {
          obj[prop] = value
          if (object.__template__ && Object.prototype.hasOwnProperty.call(object.__template__.dict, prop)) {
            self.watch(obj, prop, value)
          }
        }
        // return Reflect.set(obj, prop, value)
        return true
      },
      get(obj, prop) {
        if (typeof get === 'function') {
          return get.call(self, obj, prop)
        }
        if (typeof obj[prop] === 'object' && obj[prop] !== null) {
          return new Proxy(obj[prop], handle)
        } else {
          return Reflect.get(obj, prop)
        }
        // return obj[prop]
      }
    }
    return new Proxy(target, handle)
  }
}

/**
 * @usage
 * observer(this).create(data)
 */
const observer = function(object) {
  if (typeof object !== 'object') {
    logger.error('observer', 'this is not an object.')
  }
  return new Observer(object)
}

export default observer