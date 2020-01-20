/**
 * @Copyright(C) 2019.
 * All Rights Reserved.
 * @file Delegator.js
 * @desc delegator for event of DOM，includes on,off,once etc.
 * @see
 * https://github.com/dgraham/delegated-events
 * https://craig.is/riding/gators
 * @author Jarry
 */
import Logger from "./Logger"

let logger = Logger.get('Delegator.js')
function isElement(node) {
  if (typeof HTMLElement !== 'undefined') {
    return node instanceof HTMLElement
  } else if (typeof node === 'object') {
    return node.nodeType === 1 && (typeof node.nodeName === 'string')
  }
  return false
}

function addEvent(ele, event, handler, capture) {
  if (capture === undefined) {
    capture = (event === 'blur' || event === 'focus')
  }
  if (isElement(ele)) {
    ele.addEventListener(event, handler, capture)
  }
}

function cancelEvent(e) {
  e.preventDefault()
  e.stopPropagation()
}
function getMatcheSelector(ele, target, selector) {
  if (target === ele) {
    return null
  }
  if(target.matches && target.matches(selector)) {
    return target
  }
  if (target.parentNode) {
    return getMatcheSelector(ele, target.parentNode, selector)
  }
}

function matchesSelector(ele, target, selector) {
  while (target && target !== ele) {
    if (target.matches(selector)) {
      return true
    }
    target = target.parentElement
  }
  return false
}
/**
 * @desc delegate main method
 * @param {Element} ele 
 * @param {string} event 
 * @param {string|Array} selector 
 * @param {function} fn 
 * @param {boolean} [capture]
 * @returns {boolean} is matched selector
 */function delegate(ele, event, selector, fn, capture) {
  const matches = (target, selector) => {
    if (target && target.matches) {
      if (!(Array.isArray(selector))) {
        return target.matches(selector)
      }
      for (let i = 0, l = selector.length; i < l; i++) {
        if (target.matches(selector[i])) {
          return true
        }
      }
    }
    return false
  }
  function fnWrapper(e) {
    e = e || window.event
    let target = e.target || e.srcElement
    // currentTarget is ele
    let current = e.currentTarget
    let bubble = true
    let result
    while (bubble && target !== current && target) {
      if (matches(target, selector)) {
        // prevent event while return false
        result = fn.call(target, e)
        bubble = result === false ? false : true
      }
      if (!bubble) {
        cancelEvent(e)
        return
      }
      target = target.parentNode
    }
  }

  fn.__delegateWrapper = fnWrapper
  addEvent(ele, event, fnWrapper, capture)
}
/**
 * delegator class
 * @usage
 * let delegator = new Delegator(element)
 * delegator.on('click', '#id', () => {})
 */
class Delegator {
  element = null
  constructor(ele) {
    if (isElement(ele)) {
      this.element = ele
    } else {
      logger.error('constructor', 'new instance', 'element:', this.element)
    }
    return this
  }

  off(event, fn, capture) {
    // mount delegateWrapper property for remove the anonymous function 
    if (fn.__delegateWrapper) {
      fn = fn.__delegateWrapper
      delete fn.__delegateWrapper
    }
    this.element.removeEventListener(event, fn, capture)
    return this
  }

  on(event, selector, fn, capture) {
    if (Array.isArray(selector)) {
      selector.forEach(item => {
        delegate(this.element, event, item, fn, capture)
      })
    } else {
      delegate(this.element, event, selector, fn, capture)
    }
    return this
  }

  once(event, selector, fn, capture) {
    this.on(event, selector, fn, {
      capture,
      once: true
    })
    return this
  }
}

/**
 * output static object from delegator
 * @usage
 * delegator('#id').on('click', '#id', () => {})
 * delegator(element).on('mouseout', '.className', () => {})
 */
let instance = null
const delegator = function(ele) {
  if (typeof ele === 'string') {
    ele = document.querySelector(ele)
  }
  if (!instance) {
    instance = new Delegator(ele)
  } else {
    instance.element = ele
  }
  return instance
}

export default delegator