/**
 * Copyright (C) 2019.
 * All Rights Reserved.
 * @file Player.js
 * @desc
 * the player main stream
 * load data by url -> get the data -> ts demux -> get h265 data -> Webassmebly decode -> YUV data -> draw yuv to Canvas -> image and audio synv -> audio stream -> AudioContext decode and play
 * @author Jarry
 */

import getEvents from './toolkit/Events.js'
import Element from './toolkit/Element.js'
import AlertError from './error/AlertError'
import { throwError } from './error/ThrowError'
import BaseClass from './base/BaseClass.js'
import LoaderController from './loader/LoaderController'
import DataController from './data/DataController'
import Action from './action/Action.js'
import AudioPlayer from './audio/AudioPlayer.js'
import { Config, READY } from './config/Config'
import PlayerUtil from './utils/PlayerUtil'
import ComponentsController from './components/ComponentsController'
import ControlBarController from './control-bar/ControlBarController'
import DataProcessorController from './data-processor/dataProcessorController'
import StreamController from './action/StreamController.js'
import ImagePlayer from './imageplayer/ImagePlayer.js'
import webworkify from 'webworkify-webpack'
import Events from './config/EventsConfig'

class Player extends BaseClass {
  mode = Config.mode
  $container = null
  componentsController = null
  controlBarController = null
  controlBarHeight = 50
  alertError = null
  dataController = null
  demuxer = null
  decoder = null
  preload = true
  startTime = 0
  screenWidth = null
  screenHeight = null
  options = {}
  #libPath = Config.libPath
  readyStatus = { dataProcessor: false, firstData: false, audioPlayer: false }
  reseting = false
  #currentTime = 0
  #seek = false
  #playbackRate = 1
  #muted = false
  maxBufferLength = READY.MAXBUFFERLENGTH
  seekSegmentNo = -1
  status = 'init'
  loader = null
  currentIndex = null
  startIndex = 1
  dataManage = null
  paused = false
  autoPlay = true
  duration = 0
  tsNumber = 0
 /**
  * @property {string} sourceURL - The url of the video to play
  * @property {string} source - The url of the video to play
  * @property {Object} defaultRate - The default value of playing rate
  * @property {string} type - The type of the video, such as HLS
  * @property {Object[]} rateList - The rate list of the player
  * @example <caption>Example of rateList.</caption>
  * // let options = {
*        rateList:[
           {"url":"http://localhost/20190902/01/a5/029f8fad8868a7116f20d8ae5b075996.m3u8","id":51,"name":"720P","value":"720"},
           {"url":"http://localhost/20190902/f0/db/ee545466ced38973a9d60fe7f24ed409.m3u8","id":51,"name":"高清","value":"600"},
           {"url":"http://localhost/20190902/78/6c/5a5a99476f4f792e2e7a701ba1f6d5ad.m3u8","id":264,"name":"极速","value":"jisu"},
           {"url":"http://localhost/20190902/54/05/7e714a321d9e7d92c937582b2e439833.m3u8","id":265,"name":"流畅","value":"300"}]
       }
  * @property {Function} processURL - process the url of video source 
  * @property {Number} maxBufferLength - The maximum value of the buffer, its default value is 5000(ms)
  * @property {Boolean} autoPlay - If auto play after initializing the Player
  * @property {string} libPath - The path of decoder
  * @property {Boolean} preload - If pre load video before playing
  * @property {Number} startTime - Start time to play the video
  * @property {string} playbackRate - Playback speed
  * @property {Number} controlBarHeight - The height of the control bar
  * @property {AlertError} alertError - The alert info when error happens
  * @property {Worker} httpWorker - set User's web worker
  * @property {Function} afterLoadPlaylist - To handle operations after playlist is loaded
 */
  constructor (el, options = {}) {
    super()
    if (!el) {
      this.logger.error('Please pass in a dom object as the display container')
    }
    this.el = el
    Object.assign(this.options, options)
    this.options.sourceURL = this.options.sourceURL || this.options.source
    this.options.streamList = this.options.streamList || []
    this.options.events = getEvents()
    this.maxBufferLength = options.maxBufferLength !== undefined ? options.maxBufferLength : this.maxBufferLength
    this.autoPlay = options.autoPlay !== undefined ? options.autoPlay : this.autoPlay
    this.controlBarAutoHide = options.controlBarAutoHide !== undefined ? options.controlBarAutoHide : this.controlBarAutoHide
    this.#libPath =
      options.libPath !== undefined ? options.libPath : this.#libPath
    this.preload =
      options.preload === undefined ? this.preload : options.preload
    this.startTime = options.startTime === undefined ? this.startTime : options.startTime
    this.originStartTime = this.startTime
    this.playbackRate = options.playbackRate === undefined ? this.playbackRate : options.playbackRate
  }
  setAlertError () {
    this.options.alertError = this.alertError = AlertError.getInstance({
      player: this,
      component: this.componentsController.alertBox,
      events: this.options.events
    })
  }
  setDataController () {
    this.dataController = DataController.getInstance({
      player: this,
      events: this.options.events
    })
  }
  setDataManage () {
    this.dataController.setDataManage({
      player: this,
      type: this.options.type,
      events: this.options.events
    })
    this.dataManage = this.dataController.dataManage
  }
  setComponentsController () {
    this.componentsController = ComponentsController.getInstance({
      $container: this.$container,
      $screenContainer: this.$screenContainer,
      $canvas: this.$canvas,
      $audioContainer: this.$audioContainer,
      $audio: this.$audio,
      dataManage: this.dataManage,
      bigPlayButtonColor: this.bigPlayButtonColor,
      player: this,
      events: this.options.events
    })
  }
  setControlBarController () {
    const options = Object.assign({}, this.options, {
      $container: this.$container,
      $screenContainer: this.$screenContainer,
      controlBarAutoHide: this.controlBarAutoHide,
      player: this
    })
    this.controlBarController = ControlBarController.getInstance(options)
  }
  setLoadController () {
    this.loaderController = LoaderController.getInstance(this.options.type, {
      player: this,
      events: this.options.events
    })
  }
  setProcessorController() {
    this.processController = new DataProcessorController({
      type: 'ts',
      libPath: this.#libPath,
      events: this.options.events,
      player: this
    })
  }
  setStreamController () {
    this.streamController = new StreamController({
      events: this.options.events,
      dataManage: this.dataManage,
      imagePlayer: this.imagePlayer,
      audioPlayer: this.audioPlayer,
      player: this
    })
  }
  setImagerPlayer () {
    this.imagePlayer = new ImagePlayer({
      events: this.options.events,
      canvas: this.$canvas,
      maxBufferLength: this.maxBufferLength,
      player: this
    })
  }
  setAudioPlayer () {
    this.audioPlayer = new AudioPlayer({
      player: this,
      events: this.options.events,
      audioNode: this.$audio
    })
  }
  setAction () {
    this.action = new Action({
      player: this,
      screen: this.screen,
      imagePlayer: this.imagePlayer,
      dataManage: this.dataManage,
      audioPlayer: this.audioPlayer,
      events: this.options.events
    })
  }
  init () {
    this.controlBarHeight = this.options.controlBarHeight || this.controlBarHeight
    this.options.httpWorker = webworkify(require.resolve('./toolkit/HTTP.js'), {
      name: 'httpWorker'
    })
    this.currentTime = this.startTime
    this.addEl()
    this.setDataController()
    this.setDataManage()
    this.setComponentsController()
    this.setLoadController()
    this.setControlBarController()
    this.componentsController.setControlBarController(this.controlBarController)
    this.setAlertError()
    this.setProcessorController()
    this.setImagerPlayer()
    this.setAudioPlayer()
    this.setAction()
    this.setStreamController()

    this.componentsController.drawPoster()
    if (this.preload) {
      this.run()
    }
    this.bindEvent()
  }
  bindEvent () {
    this.events.on(Events.PlayerOnPlay, () => {
      this.play()
    })
    this.events.on(Events.PlayerOnPause, () => {
      this.pause()
    })
    this.events.on(Events.PlayerOnVolume, (value) => {
      this.volume = value
    })
    this.events.on(Events.DataProcessorReady, () => {
      this.logger.info('bindEvent', 'decoder ready')
      this.checkReady('dataProcessor')
    })
    this.events.on(Events.AudioPlayerReady, () => {
      this.logger.info('bindEvent', 'audioPlayer ready')
      if (!this.seeking) {
        this.checkReady('audioPlayer')
      }
    })
    this.events.on(Events.PlayerReady, () => {
      this.logger.info('bindEvent', 'player ready')
      this.onReady()
    })
    this.events.on(Events.PlayerSpeedTo, (data) => {
      this.changeSpeed(data)
    })
    this.events.on(Events.PlayerChangeRate, (data) => {
      this.changeRate(data)
    })
    this.events.on(Events.PlayerWait, () => {
      this.onWait() 
    })
    this.events.on(Events.PlayerPlay, () => {
      this.onPlay()
    })
    this.events.on(Events.LoaderPlayListLoaded, data => {
      if (typeof this.options.afterLoadPlaylist == 'function') {
        this.options.afterLoadPlaylist(this.laodData.sourceData)
      }
      let sourceData = data.dataManage.sourceData
      this.duration = sourceData.duration
      this.tsNumber = sourceData.length
      this.streamController.setBaseInfo({
        duration: this.duration,
        tsNumber: this.tsNumber
      })
      this.dataController.startLoad(this.startTime)
      this.setStartTime(this.originStartTime)
    })
    this.events.on(Events.DataManageFirstLoaded, buffer => {
      this.logger.info('bindEvent', 'first data ready')
      this.startIndex = buffer.no
      this.streamController.currentIndex = buffer.no
      this.checkReady('firstData')
    })
    this.events.on(Events.StreamDataReady, () => {
      this.logger.info('bindEvent', 'dataReady')
      this.onDataReady()
    })

    this.events.on(Events.PlayerLoadedMetaData, (width, height) => {
      this.setCanvas()
      this.resizeScreen(width, height)
    })
    this.events.on(Events.PlayerEnd, () => {
      this.status = 'end'
    })
    this.events.on(Events.ImagePlayerBuffeUpdate, () => {
      let buffer = this.buffer()
      this.events.emit(Events.PlayerbufferUpdate, buffer)
    })
    this.events.on(Events.PlayerOnSeek, (time) => {
      this.seek(Math.floor(time))
    })
    this.events.on(Events.PlayerAlert, (content) => {
      this.alertError.show(content)
    })
    this.events.on(Events.PlayerThrowError, (errors) => {
      throwError.apply(this, errors)
    })
  }
  reset (value) {
    if (this.action) {
      this.action.reset(value)
    }
  }
  switchPlaylist (url, callback) {
    this.loaderController.switchPlaylist(url, callback)
  }
  /**
   * @method
   * @name changeSpeed
   * @param {Object} data - data.value, The value of playback speed
   * @description Change the playback speed, such as 1, 0.5, 1.5, 2...*/
  changeSpeed (data = {}) {
    this.playbackRate = data.value || 1
  }

  setStartTime (time) {
    this.startTime = time
  }
  /**
   * @method
   * @name changeRate
   * @param {Object} data - The url of the video source
   * @param {function} callback - Function to handle after changing the video source 
   * @description Change the rate of the video source, such as 720P, HD...*/
  changeRate (data) {
    this.pause()
    this.events.emit(Events.ControlBarPauseLoading, this)
    this.setStartTime((this.currentTime - 5000) / 1000)
    this.changing = true
    this.seeking = false
    this.imagePlayer.firstRender = false
    this.readyStatus = { dataProcessor: false, firstData: false, audioPlayer: false }
    this.reset(true)
    this.switchPlaylist(data.url)
  }
  /**
   * @method
   * @name changeSrc
   * @param {string} url - The url of the video source
   * @param {function} callback - Function to handle after changing the video source 
   * @description Change the source of the video to play*/
  changeSrc (url, callback) {
    this.pause()
    this.events.emit(Events.ControlBarPauseLoading, this)
    this.events.emit(Events.PlayerChangeSrc, this)
    this.changing = true
    this.seeking = false
    this.imagePlayer.firstRender = false
    this.readyStatus = { dataProcessor: false, firstData: false, audioPlayer: false }
    this.currentTime = this.startTime
    this.imagePlayer.clear()
    this.reset(true)
    this.switchPlaylist(url, callback)
  }
  setCanvas () {
    const $canvas = PlayerUtil.createCanvas(this)
    if (Element.isElement(this.$canvas)) {
      if (this.$canvas.width && this.$canvas.height) {
        this.imagePlayer.setScreenRender($canvas)
        this.$canvas.replaceWith($canvas)
        this.$canvas = $canvas
        return
      }
    } else {
      this.$screen.appendChild($canvas)
      this.$canvas = $canvas
    }
  }
  /**
   * @method
   * @name destroy
   * @description destroy the instance of Class Player*/
  destroy () {
    if (this.controlBarController) {
      this.controlBarController.destroy()
      delete this.controlBarController
    }
    if (this.$container) {
      this.el.removeChild(this.$container)
      delete this.$container
    }
    this.processController.destroy()
    this.loaderController.destroy()
  }

  run () {
    this.loaderController.run()
  }

  checkReady (type) {
    let readyStatus = this.readyStatus
    if (type && typeof type === 'string') {
      readyStatus[type] = true
      let keys = Object.keys(readyStatus)
      for (let i = 0; i < keys.length; i++) {
        if (!readyStatus[keys[i]]) {
          return false
        }
      }
      this.logger.info('checkReady', 'player ready')
      this.events.emit(Events.PlayerReady)
      return true
    } else {
      this.logger.error('checkReady', 'check ready', 'type is no correct, type:', type)
      return false
    }
  }

  addEl () {
    let $container, $screen, $audioContainer, $audio
    if (!this.el) {
      this.logger.error('addEl', 'not found el.', 'el:', this.options.el)
      return
    }

    $container = PlayerUtil.createContainer(this)
    this.el.appendChild($container)
    this.$container = $container

    $screen = PlayerUtil.createScreenContainer(this)
    this.$screen = $screen
    $container.appendChild($screen)
    this.$screenContainer = $screen

    this.setCanvas()

    $audio = PlayerUtil.createAudio(this)
    this.$audio = $audio
    $audioContainer = PlayerUtil.createAudioContainer(this)
    $audioContainer.appendChild($audio)
    this.$audioContainer = $audioContainer
    $container.appendChild($audioContainer)


  }
  onWait () {
    this.logger.info('onWait', 'wait,wait,wait')
  }
  onPlay () {
    this.logger.info('onPlay', 'play, play, play')
  }
  onReady () {
    if (!this.changing) {
      this.componentsController.run()
    }
    if (this.changing) {
      this.logger.info('onReady', 'change ready', 'startIndex:', this.startIndex)
    }
    this.streamController.startLoad(this.startIndex)
  }

  onDataReady () {
    if (this.changing) {
      this.changing = false
      this.play()
    }
    if (this.seeking || (this.autoPlay && !this.paused)) {
      this.play()
    }
  }

  buffer () {
    let videoBuffered = this.imagePlayer.buffer()
    let audioPlayerBuffered = this.audioPlayer.buffer()
    let sTime = Math.max(videoBuffered.start, audioPlayerBuffered.start)
    let eTime = Math.min(videoBuffered.end, audioPlayerBuffered.end)

    if (sTime < eTime) {
      return [sTime, eTime]
    }
    return [0, 0]
  }
  /**
   * @method
   * @name play
   * @description play the video*/
  play() {
    this.logger.info('play', this.status)
    if (this.status !== 'playing') {
      this.logger.info('start play')
      this.status = 'playing'
      this.paused = false
      this.action.play(this.currentTime)
      this.events.emit(Events.PlayerPlay, this)
    }
  }
  on (name, callback) {
    this.events.on('Player.' + name, callback)
  }
  off (name, callback) {
    this.events.off('Player.' + name, callback)
  }
  once (name, callback) {
    this.events.once('Player.' + name, callback)
  }
  /**
   * @method
   * @name pause
   * @description pause the video*/
  pause () {
    if (this.status != 'pause') {
      this.logger.info('pause')
      this.status = 'pause'
      this.action.pause()
      this.paused = true
      this.events.emit(Events.PlayerPause, this)
    }
  }
  /**
   * @method
   * @name seek
   * @param {number} time - the duration of seeking
   * @description seek time to play*/
  seek (time) {
    if (time < this.startTime) {
      return
    }
    if (time >= this.duration * 1000) {
      this.logger.info('seek', 'seek to time:', time)
      return
    }
    this.seekTime = Date.now()
    this.seeking = true
    this.currentTime = time
    this.action.seek(time)
  }
  get muted () {
    return this.#muted
  }
  set muted (value) {
    this.#muted = !!value
  }
  set playbackRate (value) {
    this.#playbackRate = value
  }
  get playbackRate () {
    return this.#playbackRate
  }
  set seeking (value) {
    this.#seek = value
    if (value) {
      this.events.emit(Events.PlayerSeeking)
    } else {
      this.events.emit(Events.PlayerSeekEnd)
    }
  }
  get seeking () {
    return this.#seek
  }
  get currentTime () {
    return this.#currentTime
  }
  set currentTime (time) {
    this.#currentTime = time
  }
  get volume () {
    return this.audioPlayer.volume
  }
  set volume (value) {
    this.audioPlayer.volume = value
  }
  resizeScreen (width, height) {
    Element.adaptSizeElement(width, height, this.$screenContainer, this.$canvas)
  }
}

export default Player
