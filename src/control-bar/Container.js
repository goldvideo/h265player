/**
 * @copyright: Copyright (C) 2019
 * @file Container.js
 * @desc
 * progress bar container
 * @see
 * @author Jarry
 */

import BaseComponent from '../base/BaseComponent'

class Container extends BaseComponent {
  template = this.createTemplate`
    <gp-control class="goldplay__control--container ${'containerFloatCss'}" style="width:${'width'}px;height:${'height'}px;opacity:${'opacity'}" data-status="${'status'}">
      ${'progressBarName|component'}
      ${'sideControlBarName|component'}
      ${'nearControlBarName|component'}
    </gp-control>
  `
  hideDelayTime
  hideTimeCount
  data = {
    progressBarName: 'progressBar',
    sideControlBarName: 'sideControlBar',
    nearControlBarName: 'nearControlBar',
    width: '',
    height: '',
    opacity: 1,
    containerFloatCss: '',
    display: 'show',
    status: ''
  }
  options = {}

  constructor(options = {}) {
    super(options)
    this.options = options
    this.hideDelayTime = this.options.player.controlBarAutoHideTime || 3
    if (options.player.controlBarAutoHide) {
      this.data.containerFloatCss = this.options.cssName.controlContainerFloat
      this.resetPosition()
    }
    Object.assign(this.data, options.data)
    this.init()
  }

  initProps() {
    this.hideTimeCount = this.hideDelayTime
  }

  bindEvent() {
    const options = this.options
    if (options.player.controlBarAutoHide) {
      options.$container.addEventListener('mousemove', () => {
        if (this.hideTimeCount <= 0) {
          this.data.display = 'show'
          this.show()
        }
        this.hideTimeCount = this.hideDelayTime
      })
      setInterval(() => {
        if (this.hideTimeCount > 0) {
          this.hideTimeCount -= 1
        } else {
          if (this.data.display !== 'hide') {
            this.data.display = 'hide'
            this.hide()
          }
        }
      }, 100)
    }
  }

  setSize(width, height) {
    if (width !== undefined) {
      this.data.width = width
    }
    if (height !== undefined) {
      this.data.height = height
    }
  }

  show() {
    let timer
    if (this.options.player.controlBarAutoHide) {
      clearTimeout(timer)
      timer = setTimeout(() => {
        this.data.opacity = 1
      }, 1)
    } else {
      this.data.opacity = 1
    }
  }

  hide() {
    this.data.opacity = 0
  }

  resetPosition() {
    this.setSize(
      this.options.$container.offsetWidth,
      this.options.player.controlBarHeight
    )
  }
}

export default Container
