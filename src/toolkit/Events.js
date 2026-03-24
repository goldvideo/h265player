/**
 * Copyright (C) 2019.
 * All Rights Reserved.
 * @file Events.js
 * @desc
 * events observer for invoking between classes object
 * @see
 * https://github.com/Olical/EventEmitter
 * @author Jarry
 */
import Logger from './Logger.js'
let logger = Logger.get('Events.js')

export class Events {
  eventsQueue = {}
  target = {}
  disallowRepeat = false
  constructor (target) {
    this.target = target
  }

  add(types = [], fn, once) {
    for (let type of types) {
      this.on(type, fn, once)
    }
  }

  on(type, fn, once) {
    if (this.eventsQueue[type] === undefined) {
      this.eventsQueue[type] = { methods: [] }
    }
    if (typeof fn !== 'function') {
      logger.error('on', 'the argument is not function.', fn)
      return
    }
    // disallow repeat bind
    if (this.disallowRepeat && (this.eventsQueue[type]['methods'].some(m => m.fn === fn))) {
      return
    }
    (this.eventsQueue[type]).methods.push({ fn, once: !!once })
    return this.target
  }

  once(type, fn) {
    this.on(type, fn, true)
  }
  /**
   * 
   * @param {string} type 
   * @param {Function} [fn] be removed function, default all
   */
  off(type, fn) {
    let event = this.eventsQueue[type]
    if (!event) {
      return
    }
    let methods = event.methods
    if (!fn) {
      delete this.eventsQueue[type]
    } else {
      let len = methods.length
      while(len--) {
        if (methods[len].fn === fn) {
          methods.splice(len, 1)
        }
      }
    }
    return this.target
  }

  emit(type, ...args) {
    let event = this.eventsQueue[type]
    if (!event) {
      return
    }
    let methods = event.methods
    methods.forEach(method => {
      method.fn.apply(this.target, args)
    })
    // remove only listeners marked as once
    event.methods = methods.filter(m => !m.once)
    if (event.methods.length === 0) {
      delete this.eventsQueue[type]
    }
    return this.target
  }

  clear(type) {
    delete this.eventsQueue[type]
  }

  clearAll() {
    this.eventsQueue = {}
  }
}

export const events = (obj) => {
  return new Events(obj)
}

const getEvents = function(obj) {
  const instance = new Events(obj)
/**
 * @usage
 * events(this).on('loaddata.run', () => {})
 * events(this).off('audioData.execute', fn)
 * @example
  var a = {
    name: 'a',
    bind: function() {
      events(this).on('a.run', this.run)
    },
    run: function() {
    console.log('a.run:', this.name, arguments)
    }
  }
  var b = {
    name: 'b',
    bind: function() {
      events(this).on('b.run', () => {
        console.log('b.run:on', this.name, arguments)
        this.run()
      })
    },
    run: function() {
      console.log('b.run:', this.name, arguments)
    }
  }
  a.bind() // on(a.run)
  b.bind() // on(b.run)
  events(a).emit('a.run') // emit a
  events(b).emit('b.run') // emit b
  events(a).off('a.run', a.run) // off a.run
  events(a).emit('a.run')// off same function
  events(b).off('b.run', () => {}) // off b.run
  events(a).emit('b.run') // off different function
 */
  // NOTE: Intentional centralized event bus pattern. The returned closure
  // rebinds instance.target to the calling object on each access. Event handlers
  // should use arrow functions to preserve their own `this` context.
  return (obj) => {
    instance.target = obj
    return instance
  }
}

export default getEvents