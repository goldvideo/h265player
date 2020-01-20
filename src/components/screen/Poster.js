/**
 * @copyright: Copyright (C) 2019
 * @desc: loading poster image
 * @author: Jarry
 * @file: Poster.js
 */

import BaseComponent from '../../base/BaseComponent'
import Events from '../../config/EventsConfig'
import { sizeFormat } from '../../utils/Format'

const GOLDPLAY_LEGO_BASE64 = `data:img/jpg;base64,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
rkJggg==`

class Poster extends BaseComponent {
  template = this.createTemplate`
  <gp-poster class="goldplay__screen--poster">
  <img src="${'poster'}" width="${'width'}" data-display="${'display'}" heigth="${'height'}" class="goldplay__screen--poster-image">
  <gp-speed class="goldplay__screen--poster-speed">${'speed'}</gp-speed>
  </gp-poster>
  `
  data = {
    poster: '',
    status: '',
    display: 'show',
    speed: '',
    width: '',
    height: ''
  }
  options = {}
  constructor(options = {}) {
    super(options)
    this.options = options
    if (!options.player.poster) {
      this.data.poster = GOLDPLAY_LEGO_BASE64
    } else {
      this.data.poster = options.player.poster
    }
    Object.assign(this.data, options.data)
    this.init()
  }

  resetPosition() {
    if (!this.element) {
      return
    }
    const width = this.element.parentNode.offsetWidth
    const height = this.element.parentNode.offsetHeight
    this.element.style.width = width + 'px'
    this.element.style.marginTop = (height - this.element.offsetHeight - 20) / 2 + 'px'
  }

  bindEvent() {
    this.events.on(Events.LoaderUpdateSpeed, (data) => {
      if (this.data.display === 'show') {
        this.data.speed = sizeFormat.formatBytes(data.speed) + ' /s'
      }
    })
  }

  hide() {
    if (this.data.display !== 'hide') {
      // let value = 1
      // let timer = setInterval(() => {
      //   if (value <= 0) {
      //     this.element.style.display = 'none'
      //     clearInterval(timer)
      //     return
      //   }
      //   value = (value - 0.1).toFixed(2)
      //   this.element.style.opacity = value
      // }, 50)
      this.element.style.opacity = 0
      this.element.style.display = 'none'
      this.data.display = 'hide'
    }
  }
}

export default Poster