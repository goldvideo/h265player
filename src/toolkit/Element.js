/**
 * @copyright: Copyright (C) 2019
 * @desc: methods of operation dom 
 * @author: liuliguo 
 * @file: Element.js
 */

import Logger from './Logger'
let logger = Logger.get('Element.js')
export default class Element {
  static createEl(tagName = 'div', options) {
    if (typeof tagName != 'string') {
      logger.error('please input element name')
      return null
    }
    let el = document.createElement(tagName, options)
    return el
  }

  /**
   * 
   * @param {string} tagName 
   * @param {HTMLElement} [extendEle] 
   * @param {string} [extendEle] 
   */
  static registerElement(tagName, extendEle = HTMLElement, extendName) {
    let el = document.registerElement(tagName, {
      prototype: Object.create(extendEle.prototype),
      extends: extendName
    })
    return el
  }

  static addEl(el, parent) {
    if (el && parent) {
      try {
        parent.appendChild(el)
      } catch (error) {
        logger.error(error)
      }
    } else {

    }
  }
  static removeEl(el) {
    try {
      let parent = el.parentNode
      if (parent) {
        parent.removeChild(el)
      }
    } catch (error) {
      logger.error(error)
    }
  }
  static addClass(el, ...classNames) {
    try {
      el.classList.add(...classNames)
    } catch (error) {
      logger.error(error)
    }
  }
  static removeClass() {

  }
  static hasClass() {}
  static isElement(obj) {
    try {
      return obj instanceof HTMLElement
    } catch (e) {
      return (typeof obj === 'object') &&
        (obj.nodeType === 1) && (typeof obj.style === 'object') &&
        (typeof obj.ownerDocument === 'object')
    }
  }
  
  static setAttributes(node, attrs) {
    if (!Element.isElement(node)) {
      return
    }
    for (let i = 0, l = attrs.length; i < l; i++) {
      let attr = attrs[i]
      let name = attr.name
      name = attr.name.replace(/["|']/g, '')
      node.setAttribute(name, attr.value)
    }
  }

  static syncAttributes(oldNode, newNode) {
    const newAttrs = newNode.attributes
    Element.setAttributes(oldNode, newAttrs)
    const oldAttrs = oldNode.attributes
    Element.setAttributes(newNode, oldAttrs)
  }

  static getClientWidth() {
    return document.documentElement.clientWidth ? document.documentElement.clientWidth : document.body.clientWidth
  }

  static getClientHeight() {
    return document.documentElement.clientHeight ? document.documentElement.clientHeight : document.body.clientHeight
  }

  static adaptSizeElement(width, height, $container, $element) {
    const $box = $container
    const $canvas = $element
    $canvas.width = width || $canvas.width || $box.offsetWidth
    $canvas.height = height || $canvas.height || $box.offsetHeight
    const canvasWidth = $canvas.width
    const canvasHeight = $canvas.height
    let proportion = 0
    $canvas.style.position = 'absolute'

    if ($box.offsetWidth <= 0) {
      $box.style.width = canvasWidth + 'px'
    }
    if ($box.offsetHeight <= 0) {
      $box.style.height = canvasHeight + 'px'
    }

    const widthProportion = $box.offsetWidth / canvasWidth
    const heightProportion = $box.offsetHeight / canvasHeight

    if (heightProportion > widthProportion) {
      proportion = widthProportion
    } else {
      proportion = heightProportion
    }
    $canvas.style.top = $box.offsetTop + (($box.offsetHeight - canvasHeight * proportion) / 2)  + 'px'
    $canvas.style.left = $box.offsetLeft + (($box.offsetWidth - canvasWidth * proportion) / 2)  + 'px'
    $canvas.style.transform = `scale(${proportion}, ${proportion})`
    $canvas.style['transform-origin'] = `top left`;
    $canvas.style.display = 'inline-block'
  }
}