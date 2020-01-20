/**
 * @copyright: Copyright (C) 2019
 * @desc: First Play Button
 * @author: Jarry
 * @file: BigPlayButton.js
 */

import delegator from '../../toolkit/Delegator.js'
import BaseComponent from '../../base/BaseComponent'
import Template from '../../toolkit/Template'
import Events from '../../config/EventsConfig'

const BIGPLAY_ICON = Template.create `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
width="${'width'}" height="${'height'}" viewBox="0 0 438.533 438.533" style="${'iconStyle'}" xml:space="preserve">
<g>
<path d="M409.133,109.203c-19.608-33.592-46.205-60.189-79.798-79.796C295.736,9.801,259.058,0,219.273,0
 c-39.781,0-76.466,9.801-110.063,29.407c-33.595,19.604-60.192,46.201-79.8,79.796C9.801,142.8,0,179.489,0,219.267
 s9.804,76.463,29.407,110.062c19.607,33.585,46.204,60.189,79.799,79.798c33.597,19.605,70.283,29.407,110.063,29.407
 s76.47-9.802,110.065-29.407c33.593-19.602,60.189-46.206,79.795-79.798c19.603-33.599,29.403-70.287,29.403-110.062
 C438.533,179.489,428.732,142.795,409.133,109.203z M328.904,234.966L173.588,326.33c-2.856,1.711-5.902,2.567-9.136,2.567
 c-3.045,0-6.09-0.764-9.135-2.286c-6.09-3.614-9.136-8.939-9.136-15.985V127.907c0-7.041,3.046-12.371,9.136-15.987
 c6.28-3.427,12.369-3.333,18.271,0.284l155.316,91.36c6.088,3.424,9.134,8.663,9.134,15.703
 C338.038,226.308,334.992,231.537,328.904,234.966z" fill="${'fillColor'}">
</g>
</svg>
`

const PLAY_BUTTON_COLOR = '#999'

class BigPlayButton extends BaseComponent {
  template = this.createTemplate `
  <gp-button class="goldplay__screen--bigplay" title="${'title'}" data-status="${'status'}">
  ${'icon|html'}
  </gp-button>
  `
  data = {
    titie: 'click to play',
    iconStyle: 'opacity:0.5',
    display: 'hide',
    status: '',
    width: 100,
    height: 100,
    fillColor: PLAY_BUTTON_COLOR,
    icon: BIGPLAY_ICON
  }
  options = {}
  constructor(options = {}) {
    super(options)
    this.options = options
    Object.assign(this.data, options.data)
    this.init()
  }
  watch() {
    if (this.data.display === 'show') {
      const height = this.element.parentNode.offsetHeight
      const marginTop = (height - this.data.height) / 2
      this.data.iconStyle = `opacity:0.7;margin-top:${marginTop}px`
    }
  }

  resetPosition() {
    if (this.data.display === 'show') {
      const parentNode = this.element.parentNode
      const width = parentNode.offsetWidth
      let height = parentNode.offsetHeight
      if (this.options.player.controlBarAutoHide === true) {
        height -= this.options.player.controlBarHeight
      }
      const top = parentNode.offsetTop
      const left = parentNode.offsetLeft
      this.element.style.width = width + 'px'
      this.element.style.height = height + 'px'
      this.element.style.top = top + 'px'
      this.element.style.left = left + 'px'
    }
  }

  bindEvent() {
    const $container = this.options.$screenContainer
    const cssName = this.options.cssName
    delegator($container).on('click', '.' + cssName.bigPlayButton, () => {
      this.events.emit(Events.PlayerOnPlay, this)
      this.events.emit(Events.ControlBarPlay, this)
      this.hide()
    })
    delegator($container).on('mouseover', '.' + cssName.bigPlayButton, () => {
      this.data.fillColor = this.options.bigPlayButtonColor || '#fff'
    })
    delegator($container).on('mouseout', '.' + cssName.bigPlayButton, evt => {
      const $ele = this.element
      const scope = {
        y: $ele.offsetTop,
        x: $ele.offsetLeft
      }
      scope.width = $ele.offsetWidth
      scope.height = $ele.offsetHeight
      if (evt.pageX > scope.x && evt.pageX < (scope.x + scope.width) &&
        evt.pageY > scope.y && evt.pageY < (scope.y + scope.height)
      ) {
        return
      } else {
        this.data.fillColor = PLAY_BUTTON_COLOR
      }
    })
  }

  show() {
    if (this.data.display !== 'show') {
      this.data.display = 'show'
      this.element.style.opacity = '1'
      setTimeout(() => {
        this.element.style.display = 'inline-block'
      }, 1)
    }
  }

  hide() {
    if (this.data.display !== 'hide') {
      this.element.style.opacity = '0'
      this.data.display = 'hide'
      this.element.style.display = 'none'
    }
  }
}

export default BigPlayButton