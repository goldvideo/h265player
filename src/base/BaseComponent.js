/**
 * @copyright: Copyright (C) 2019
 * @desc: the base component for control bar or video pannel
 * @author: Jarry
 * @file: BaseComponent.js
 */

import BaseClass from './BaseClass.js'
import Element from '../toolkit/Element'
import Template from '../toolkit/Template'
import observer from '../toolkit/Observer'

function getAllChildren(node) {
  if (!node) {
    return
  }
  const result = [], stack = []
  stack.push(node)
  while (stack.length) {
    const node = stack.shift()
    const slotType = node.getAttribute(Template.slotTypeName)
    // if the template is slot will be ignored
    if (Template.isSoltType(slotType)) {
      continue
    }
    result.push(node)
    const children = node.children
    for(let i = 0, l = children.length; i < l; i++) {
      stack.push(children[i])
    }
  }
  return result
}

const isHTMLSlot = (node) => {
  return (node.getAttribute && node.getAttribute(Template.slotTypeName) === Template.slotTypeMap.html)
}
const isComponentSlot = (node) => {
  return (node.getAttribute && node.getAttribute(Template.slotTypeName) ===  Template.slotTypeMap.component)
}
const needReplaceHTMLSlot = (oldNode, newNode) => {
  if (isHTMLSlot(oldNode) && isHTMLSlot(newNode)) {
    return true
  }
  return false
}
const needReplaceComponentSlot = (oldNode, newNode) => {
  if (isComponentSlot(oldNode)) {
    if (oldNode.getAttribute(Template.slotComName) !== newNode.getAttribute(Template.slotComName)) {
      return true
    }
  }
  return false
}
const updateNode = (oldChild, newChild, oldParentNode) => {
  if (!oldChild && !newChild) {
    return
  }
  if (!oldChild && newChild) {
    oldParentNode.appendChild(newChild)
  } else if (!newChild && oldChild) {
    oldParentNode.removeChild(oldChild)
  } else if (oldChild.tagName !== newChild.tagName ||
    needReplaceHTMLSlot(oldChild, newChild) || needReplaceComponentSlot(oldChild, newChild)) {
    // replace should be cloneNode for keeping the childNodes.length
    oldChild.replaceWith(newChild.cloneNode(true))
  } else if (oldChild.nodeType === Node.TEXT_NODE && oldChild.nodeValue !== newChild.nodeValue) {
    oldChild.nodeValue = newChild.nodeValue 
  } else if (oldChild.setAttribute) {
    Element.setAttributes(oldChild, newChild)
  }
}

class BaseComponent extends BaseClass {
  createTemplate = null
  template = ``
  element = null
  eventsList = {}
  data = {}
  id = ''
  constructor(options = {}) {
    super(options)
    this.id = options.id || this.constructor.name
    this.options = options
    this.createTemplate = Template.create.bind(this)
  }

  getTemplate() {
    return this.template
  }

  setTemplate(tpl) {
    this.template = tpl
  }

  init() {
    this.data = observer(this).create(this.data)
    this.render()
    if (typeof this.afterInit === 'function') {
      this.afterInit()
    }
  }

  afterInit() {

  }

  initProps() {
    
  }

  bindEvent() {

  }

  watch() {

  }
  render() {
    let html = ''
    if (typeof this.template === 'function') {
      html = this.template(this.data)
    } else {
      html = this.template
    }

    const div = Element.createEl('div')
    if (typeof html !== 'string') {
      this.logger.error('render:', 'this template is not html string', 'html:', html)
      return
    }
    div.innerHTML = html
    const node = div.firstElementChild
    // replace the blank slot components of template
    const slotList = node.querySelectorAll('[' + Template.slotReplaceName + ']')
    for (const slot of slotList) {
      if (slot.getAttribute(Template.slotReplaceName) === 'true') {
        const componentName = slot.getAttribute(Template.slotComName)
        const component = this.getComponent(componentName)
        if (!component) {
          continue
        }
        const ele = component.element
        if (Element.isElement(this.element)) {
          // replacing slot again should clone
          slot.replaceWith(ele.cloneNode(true))
        } else {
          slot.replaceWith(ele)
        }
        component.element.removeAttribute(Template.slotReplaceName)
      }
    }
    // assign or replace the template element
    if (Element.isElement(this.element)) {
      this.replaceNode(this.element, node)
    } else {
      this.element = node
    }
  }

  /**
   * replace some node after comparison
   * @param {Element} oldNode orgin DOM
   * @param {Element} newNode replace DOM
   */
  replaceNode(oldNode, newNode) {
    if (!oldNode || !newNode) {
      return
    }
    const oldNodeArr = getAllChildren(oldNode)
    const newNodeArr = getAllChildren(newNode)
    const oldNodeLen = oldNodeArr.length
    const newNodeLen = newNodeArr.length
    let nodeArrLen = Math.max(oldNodeLen, newNodeLen)
    if (nodeArrLen <= 0 || oldNode.tagName !== newNode.tagName) {
      oldNode.replaceWith(newNode)
      this.element = newNode
      return
    }
    // console.error('oldNodeArr:newNodeArr', oldNodeLen, newNodeLen, oldNodeArr, newNodeArr)
    while (nodeArrLen--) {
      let currentNode = oldNodeArr[nodeArrLen]
      let replaceNode = newNodeArr[nodeArrLen]
      // console.error('currentNode:replaceNode', nodeArrLen, currentNode, replaceNode, oldNodeArr, newNodeArr)
      if (!currentNode) {
        oldNode.appendChild(replaceNode)
        continue
      }
      if (!replaceNode) {
        currentNode.parentNode.removeChild(currentNode)
        continue
      }
      if (currentNode.tagName === replaceNode.tagName) {
        Element.syncAttributes(currentNode, replaceNode)
      }
      if (!currentNode.isEqualNode(replaceNode)) {
        // console.error('currentNode and replaceNode innerHTML:', currentNode, replaceNode, currentNode.innerHTML, replaceNode.innerHTML)
        const childNodesLength = Math.max(currentNode.childNodes.length, replaceNode.childNodes.length)
        if (childNodesLength <= 0) {
          updateNode(currentNode, replaceNode, currentNode.parentNode)
        } else {
          for (let i = 0, l = childNodesLength; i < l; i++) {
            const oldChild = currentNode.childNodes[i]
            const newChild = replaceNode.childNodes[i]
            if (!oldChild && !newChild) {
              continue
            }
            updateNode(oldChild, newChild, currentNode)
          }
        }
      }
    }
  }

  show() {
    this.data.display = 'show'
    if (this.element) {
      this.element.style.display = 'inline-block'
    }
  }

  hide() {
    this.data.display = 'hide'
    if (this.element) {
      this.element.style.display = 'none'
    }
  }

  resetPosition() {
    const $box = this.element.parentNode
    const containerWidth = $box.offsetWidth
    const containerHeight = $box.offsetHeight
    this.element.style.marginTop = (containerHeight - this.element.offsetHeight) / 2 + 'px'
    this.element.style.marginLeft = (containerWidth - this.element.offsetWidth) / 2 + 'px'
  }

  replace(node) {
    this.element.replaceWith(node)
    this.element = node
  }

  update(content) {
    this.element.innerHTML = content
  }

  addEventListener(ele, type, callback, useCapture = false) {
    ele.addEventListener(type, callback, useCapture)
    return {
      destroy() {
        ele.removeEventListener(type, callback)
      }
    }
  }

  removeEventListenerAll() {
    Object.keys(this.eventsList).forEach((item) => {
      (this.eventsList[item]).destroy()
    })
  }

  getComponent(name) {
    if (name === undefined) {
      return
    }
    if (this.options.componentsController) {
      return this.options.componentsController.getComponent(name)
    }
  }

  getHTMLString() {
    return this.element.outerHTML
  }

  destroy() {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element)
    }
    this.events.emit('Component_' + this.id + '.destroy', this)
    this.removeEventListenerAll()
  }

}

export default BaseComponent