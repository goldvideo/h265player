/**
 * @copyright: Copyright (C) 2019
 * @desc: play yuv data
 * @author: liuliguo 
 * @file: ImagePlayer.js
 */
import BaseClass from '../base/BaseClass.js'
import ImageData from './ImageData.js'
import Screen from './Screen.js'
import { READY } from '../config/Config.js'
import Events from '../config/EventsConfig'
export default class ImagePlayer extends BaseClass {
  status = 'pause'
  _currentTime = 0
  maxPTS = null
  ready = false
  firstRender = false
  constructor (options) {
    super(options)
    this.imageData = new ImageData({
      events: options.events,
      maxBufferLength: options.maxBufferLength
    })
    this.screen = new Screen({
      canvas: options.canvas
    })
    this.playHandler = null
    this.player = options.player
    this.debug = options.debug || false
  }
  setScreenRender (canvas) {
    this.screen.setCanvas(canvas)
    this.screen.setRender(canvas)
  }
  clear () {
    this.screen.clear()
  }

  play (time) {
    if (this.status !== 'play') {
      this.status = 'play'
      this.render(time)
    }
  }

  pause () {
    if (this.status !== 'pause') {
      this.status = 'pause'
      clearTimeout(this.playHandler)
      this.playHandler = null
    }
  }
  checkBuffer () {
    return this.imageData.checkBuffer(this.currentTime)
  }
  push (data) {
    if (this.player.reseting) {
      return
    }
    this.imageData.push(data)
    let end = this.end
    let duration = end - this.player.currentTime
    if (duration > READY.READYBUFFERLENGTH && !this.ready) {
      this.ready = true
      this.status = 'ready'
      this.events.emit(Events.ImagePlayerReady)
    }
    this.events.emit(Events.ImagePlayerBuffeUpdate)
  }
  find (time) {
    return this.imageData.find(time)
  }
  buffer () {
    return this.imageData.buffer()
  }
  isBuffered (time) {
    return this.imageData.isBuffered(time)
  }
  render(time) {
    if (time < this.imageData.offset) {
      return
    }
    let image = this.find(time)
    if (image) {
      if (!this.firstRender) {
        this.firstRender = true
        this.events.emit(Events.PlayerLoadedMetaData, image.width, image.height)
      }
      this.screen.drawFrame(image)
      this.currentTime = image.pts
      this.events.emit(Events.ImagePlayerRenderEnd, time, image.duration)
      return image
    } else {
      if (this.maxPTS && time >= this.maxPTS + this.fragDuration) {
        this.status = 'end'
        this.events.emit(Events.ImagePlayerEnd, this.maxPTS)
        return
      }
      this.logger.warn('Events.ImagePlayerWait', time, this.start, this.end, this.maxPTS)
      this.logger.warn('render', 'not yuv data')
      this.status = 'wait'
      this.ready = false
      this.events.emit(Events.ImagePlayerWait, 'image', 'this')
      return false
    }
  }
  reset () {
    this.status = 'pause'
    this.ready = false
    this.imageData.reset()
    this.maxPTS = null
    this.currentTime = 0
  }
  set currentTime (time) {
    this._currentTime = time
  }
  get currentTime () {
    return this._currentTime
  }
  get offset () {
    return this.imageData.offset
  }
  get fragDuration () {
    return Math.ceil(1000 / this.imageData.fps)
  }
  get start () {
    return this.imageData.start
  }
  get end () {
    return this.imageData.end
  }
  get duration () {
    return this.imageData.duration
  }
}
