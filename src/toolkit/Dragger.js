/**
 * Copyright (C) 2019.
 * All Rights Reserved.
 * @file Dragger.js
 * @desc
 * drag tool，set element, container and coordinate scope
 * @author Jarry
 */

export class Dragger {
  $container = null
  $ele = null
  active = false

  offsetX = 0
  offsetY = 0
  offsetLeft = 0
  offsetTop = 0
  orginOffsetLeft = 0
  orginOffsetTop = 0
  orginOffsetWidth = 0
  orginOffsetHeight = 0
  initialX = 0
  initialY = 0
  type = 'default'
  scope = {
    // left,
    // right,
    // top,
    // bottom
  }

  constructor($ele, {
    $container,
    type,
    scope,
    onStart, onDrag, onRelease
  }) {
    this.$container = $container || document.body
    this.$ele = $ele
    this.type = type // vertical | level | default
    this.scope = scope
    this.eventsList = {}
    this.onStart = onStart
    this.onDrag = onDrag
    this.onRelease = onRelease
    this.bindEvent()
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

  bindEvent() {
    this.eventsList.mousedown = this.addEventListener(this.$container, 'mousedown', (evt) => {
      this.start(evt)
    }, false)
    this.eventsList.mouseup = this.addEventListener(this.$container, 'mouseup', (evt) => {
      this.release(evt)
    }, false)
    this.eventsList.mousemove = this.addEventListener(this.$container, 'mousemove', (evt) => {
      this.drag(evt)
    }, false)
  }

  start(evt) {
    if (evt.target !== this.$ele) {
      return
    }
    if (this.scope === undefined && this.$container !== undefined) {
      this.scope = {
        left: this.$container.offsetLeft,
        right: this.$container.offsetLeft + this.$container.offsetWidth,
        top: this.$container.offsetTop,
        bottom: this.$container.offsetTop + this.$container.offsetHeight
      }
    }
    this.offsetLeft = this.$ele.offsetLeft
    this.offsetTop = this.$ele.offsetTop
    this.active = true
    this.initialX = evt.clientX
    this.initialY = evt.clientY
    this.orginOffsetLeft = this.$ele.offsetLeft
    this.orginOffsetTop = this.$ele.offsetTop
    this.orginOffsetWidth = this.$ele.offsetWidth
    this.orginOffsetHeight = this.$ele.offsetHeight
    if (typeof this.onStart === 'function') {
      this.onStart.call(this, this.offsetX, this.offsetY, evt, this)
    }
  }

  release(evt) {
    this.active = false
    if (typeof this.onRelease === 'function') {
      this.onRelease.call(this, this.offsetX, this.offsetY, evt, this)
    }
  }

  drag(evt) {
    // console.error('before drag position:', this.offsetLeft, this.offsetTop, this.scope, evt.clientX, evt.clientY, this.initialX, this.initialY)
    if (this.active) {
      evt.preventDefault()
      evt.stopPropagation()
      this.offsetX = evt.clientX - this.initialX + this.offsetLeft
      this.offsetY = evt.clientY - this.initialY + this.offsetTop
      this.setPosition(evt)
    }
  }

  setPosition(evt) {
    switch (this.type) {
      case 'vertical':
        this.offsetX = this.orginOffsetLeft
        if (this.offsetY < this.scope.top) {
          this.offsetY = this.scope.top
        }
        if (this.offsetY > this.scope.bottom - this.orginOffsetHeight) {
          this.offsetY = this.scope.bottom - this.orginOffsetHeight
        }
        // console.error('vertial:', this.offsetX, this.offsetY)
        break
      case 'level':
        this.offsetY = this.orginOffsetTop
        if (this.offsetX > this.scope.right - this.orginOffsetWidth) {
          this.offsetX = this.scope.right - this.orginOffsetWidth
        }
        if (this.offsetX < this.scope.left) {
          this.offsetX = this.scope.left
        }
        break
      default:
        if (!isNaN(this.scope.right)) {
          if (this.offsetX > this.scope.right - this.orginOffsetWidth) {
            this.offsetX = this.scope.right - this.orginOffsetWidth
          }
        }
        if (!isNaN(this.scope.left)) {
          if (this.offsetX < this.scope.left) {
            this.offsetX = this.scope.left
          }
        }
        if (!isNaN(this.scope.top)) {
          if (this.offsetY < this.scope.top) {
            this.offsetY = this.scope.top
          }
        }
        if (!isNaN(this.scope.bottom)) {
          if (this.offsetY > this.scope.bottom - this.orginOffsetHeight) {
            this.offsetY = this.scope.bottom - this.orginOffsetHeight
          }
        }
    }

    this.$ele.style.left = this.offsetX + 'px'
    this.$ele.style.top = this.offsetY + 'px'
    if (typeof this.onDrag === 'function') {
      this.onDrag.call(this, this.offsetX, this.offsetY, evt, this)
    }
  }

  destroy() {
    this.$ele.parentNode.removeChild(this.$ele)
    this.removeEventListenerAll()
  }

}

const dragger = function ($ele, options) {
  return new Dragger($ele, options)
}

export default dragger