/**
 * @copyright: Copyright (C) 2019
 * @desc: Progress bar
 * @author: Jarry
 * @file: ProgressContainer.js
 */

import delegator from '../../toolkit/Delegator.js'
import dragger from '../../toolkit/Dragger.js'
import { timeFormat } from '../../utils/Format'
import BaseComponent from '../../base/BaseComponent'
import Events from '../../config/EventsConfig'

class ProgressBar extends BaseComponent {
  template = this.createTemplate`
    <gp-control-progressbar class="goldplay__progress-bar ${'progressBarHoverCss'}" data-status="${'status'}">
      <div class="goldplay__progressbar--load ${'progressBarLoadHoverCss'}">
      </div>
      <div class="goldplay__progressbar--play ${'progressBarPlayHoverCss'}">
      </div>
      <span class="goldplay__progressbar--dot ${'progressBarDotHoverCss'}" title="${'time'}"></span>
    </gp-control-progressbar>
  `
  options = {}
  data = {
    playWidth: '',
    dot: '',
    time: '',
    status: ''
  }
  constructor(options = {}) {
    super(options)
    this.options = options
    Object.assign(this.data, options.data)
    this.init()
  }
  watch() {
    const cssName = this.options.cssName
    if (this.data.status === 'dragstart') {
      this.data.progressBarHoverCss = cssName.progressBarHover
      this.data.progressBarLoadHoverCss = cssName.progressBarLoadHover
      this.data.progressBarPlayHoverCss = cssName.progressBarPlayHover
      this.data.progressBarDotHoverCss = cssName.progressBarDotHover
    } else if (this.data.status === 'dragend') {
      this.data.progressBarHoverCss = ''
      this.data.progressBarLoadHoverCss = ''
      this.data.progressBarPlayHoverCss = ''
      this.data.progressBarDotHoverCss = ''

    }
  }
  afterInit() {
  }

  initProps() {
    const $progressBar = this.element
    const cssName = this.options.cssName
    this.$progressDragDot = $progressBar.querySelector('.' + cssName.progressBarDot)
    this.$progressBarPlay = $progressBar.querySelector('.' + cssName.progressBarPlay)
    this.$progressBarLoad = $progressBar.querySelector('.' + cssName.progressBarLoad)
    this.timer = this.getComponent('timer')
    this.pauseButton = this.getComponent('pauseButton')
  }

  bindEvent() {
    const cssName = this.options.cssName
    let isDraging = false

    this.events.on(Events.PlayerTimeUpdate, (time) => {
      const duration = this.options.dataManage.sourceData.duration
      if (isDraging || !time || !duration) {
        return
      }
      const width = time / 1000 / duration * this.progressBarWidth
      this.setProgressPosition(width)
      this.timer.data.time = timeFormat.formatHHMMSS(time / 1000)
    })

    this.events.on(Events.PlayerbufferUpdate, (bufferInfo) => {
      if (isDraging || !bufferInfo) {
        return
      }
      this.updateProgressLoad(bufferInfo)
    })

    delegator(this.options.$controlBarContainer).on('click', '.' + cssName.progressBar, (evt) => {
      if (evt.target === this.$progressDragDot) {
        return
      }
      const duration = this.options.dataManage.sourceData.duration || 0
      const pixelTime = duration / this.progressBarWidth
      let targetLeft = 0
      if (evt.target.classList.contains(cssName.progressBarLoad)) {
        targetLeft = evt.target.offsetLeft - evt.target.parentNode.offsetLeft
      }
      const offsetX = targetLeft + evt.offsetX
      const seekTime =  offsetX * pixelTime * 1000

      this.setProgressPosition(offsetX)

      this.logger.info('bindEvent', 'click to seek', 'seekTime:', seekTime, 'offsetX:', offsetX)
      if (evt.target !== this.$progressBarLoad) {
        this.clearLoadBar(evt.offsetX)
      }
      this.timer.data.time = timeFormat.formatHHMMSS(seekTime / 1000)
      this.events.emit(Events.PlayerOnSeek, seekTime)
      return false
    })

    this.progressDragEvent = dragger(this.$progressDragDot, {
      // $container: this.options.$controlBarContainer,
      $container: document.body,
      type: 'level',
      scope: {
        left: this.progressBarLeft,
        right: this.progressBarLeft + this.progressBarWidth,
        top: this.$progressDragDot.offsetTop,
        bottom: this.$progressDragDot.offsetTop + this.$progressDragDot.offsetHeight
      },
      onStart: () => {
        isDraging = true
        this.data.status = 'dragstart'
      },
      onDrag: (offsetX) => {
        let width
        if (this.options.player.controlBarAutoHide) {
          width = offsetX
        } else {
          width = offsetX - this.options.$controlBarContainer.offsetLeft
        }
        let gap = 0
        let gapValue = this.$progressDragDot.offsetWidth
        if (this.progressBarWidth - width <= gapValue) {
          gap = gapValue
        }
        this.setProgressBarSize(width)
        this.data.status = 'draging'
        const seekTime = this.getSeekTime(this.progressBarWidth - gap)
        this.timer.data.time = timeFormat.formatHHMMSS(seekTime / 1000)
        this.data.time = this.timer.data.time
      },
      onRelease: (offsetX, offsetY, evt) => {
        if (!isDraging) {
          return
        }
        const seekTime = this.getSeekTime()
        if (evt.target !== this.$progressBarLoad) {
          this.clearLoadBar(offsetX)
        }
        this.events.emit(Events.PlayerOnSeek, seekTime)
        this.logger.info('bindEvent', 'onDrag release seek', 'seekTime:', seekTime)
        this.data.status = 'dragend'
        isDraging = false
      }
    })

  }

  setProgressPosition(width) {
    const offsetX = Math.min(width, this.progressBarWidth)
    const $progressDragDot = this.$progressDragDot
    const progressBarWidth = this.progressBarWidth
    let gap = 0
    let gapValue = $progressDragDot.offsetWidth / 2
    if (offsetX > progressBarWidth || (progressBarWidth - offsetX) <= gapValue) {
      gap = gapValue - (progressBarWidth - offsetX)
    } else if (offsetX <= gapValue) {
      gap = -(gapValue - offsetX)
    }
    const left = (offsetX) - gap - ($progressDragDot.offsetWidth / 2)
    this.setProgressPlayWidth(offsetX)
    this.setProgressDragDotLeft(left + this.progressBarLeft)
  }

  setProgressPlayWidth(width) {
    this.$progressBarPlay.style.width = width + 'px'
  }

  setProgressDragDotLeft(left) {
    this.$progressDragDot.style.left = left + 'px'
  }

  getProgressPlayLeftWidth() {
    return {
      offsetLeft: this.$progressBarPlay.offsetLeft,
      offsetWidth: this.$progressBarPlay.offsetWidth
    }
  }

  getProgressLoadLeftWidth() {
    return {
      offsetLeft: this.$progressBarLoad.offsetLeft,
      offsetWidth: this.$progressBarLoad.offsetWidth
    }
  }

  setProgressLoadLeftWidth(left, width) {
    const maxWidth = this.progressBarLeft + this.progressBarWidth
    left = Math.min(left, maxWidth)
    const newWidth = left + width
    if (newWidth > maxWidth) {
      width = maxWidth - left
    }
    this.$progressBarLoad.style.left = left + 'px'
    this.$progressBarLoad.style.width = width + 'px'
  }

  updateProgressLoad(bufferInfo) {
    const duration = this.options.dataManage.sourceData.duration
    if (!duration) {
      return
    }
    const progressBarWidth = this.progressBarWidth
    const progressBarLeft = this.progressBarLeft
    const loadLeft = bufferInfo[0] / 1000 / duration * progressBarWidth
    const loadRight = bufferInfo[1] / 1000 / duration * progressBarWidth
    const left = Math.floor(progressBarLeft + loadLeft)
    const width = Math.floor(loadRight - loadLeft)
    this.setProgressLoadLeftWidth(left, width)
  }

  getSeekTime(width, duration) {
    const progressBarWidth = this.progressBarWidth
    duration = duration || this.options.dataManage.sourceData.duration || 0
    const pixelTime = duration / (width || progressBarWidth)
    const seekTime = this.$progressBarPlay.offsetWidth * pixelTime * 1000
    return seekTime
  }

  clearLoadBar(offsetX) {
    if (offsetX < (this.$progressBarLoad.offsetLeft - this.progressBarLeft)) {
      this.$progressBarLoad.style.width = '0px'
    }
  }

  setProgressBarSize = (width) => {
    this.$progressBarPlay.style.width = width + 'px'
  }

  getDragDotPosition() {
    return {
      offsetLeft: this.$progressDragDot.offsetLeft,
      offsetTop: this.$progressDragDot.offsetTop,
      left: this.$progressDragDot.style.left,
      top: this.$progressDragDot.style.top
    }
  }

  get progressBarWidth() {
    return this.element.offsetWidth
  }

  get progressBarLeft() {
    return this.element.offsetLeft
  }

  clearDragDotTop() {
    this.$progressDragDot.style.top = ''
  }

}

export default ProgressBar