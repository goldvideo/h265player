/**
 * Copyright (C) 2019.
 * All Rights Reserved.
 * @file Loader.js
 * @desc
 * loader proxy
 * @author Jarry
 */

import BaseController from '../base/BaseController'
import HLSLoader from './HLSLoader'
import MP4Loader from './MP4Loader'
import { state } from '../config/LoaderConfig'
import Events from '../config/EventsConfig'

const LoadersEnum = {
  // HLS, MP4, DASH
  'HLS': HLSLoader,
  'MP4': MP4Loader
}

class LoaderController extends BaseController {

  state = null
  exeLoader = null
  dataManage = null
  type = 'HLS'
  options = null
  dataController = null

  constructor(type, options) {
    super()
    this.type = type || this.type
    this.player = options.player
    this.options = options.player.options
    this.dataController = this.player.dataController
    this.init(this.type, this.options)
  }

  init(type, options) {
    this.bindEvent()
    this.setExeLoader(new (LoadersEnum[type])({
      ...options,
      player: this.player,
      loaderController: this
    }))
    this.setSourceURL(options.sourceURL)
    if (this.player.dataManage) {
      this.setDataManage(this.player.dataManage)
    } else {
      this.setDataManage(this.dataController.getDataManage(type, options))
    }
    this.exeLoader.setDataManage(this.dataManage)
  }

  run() {
    this.state = state.LOAD_PLAYLIST
    this.events.emit(Events.LoaderPlayListStart, this)
    this.logger.info('run', state[this.state], 'url:', this.options.sourceURL)
    switch(this.type.toUpperCase()) {
      case 'HLS':
        this.loadHLS()
        break
      case 'MP4':
        this.loadMP4()
        break
      default:
        this.logger.erro('run', `this ${this.type} is not valid.`, this.type)
    }
  }

  bindEvent() {
    this.events.on(Events.LoaderLoadFile, (segment, type, time) => {
      this.exeLoader.loadFile(segment, type, time)
    })
  }

  loadMP4(callback) {
    this.exeLoader.preload( (data) => {
      if (!data) {
        this.logger.error('run', 'start preload mp4', 'data:', data)
        return
      }
      if (typeof callback === 'function') {
        console.info('mp4Preload data:', data);
        callback.call(this, data)
      }
      // this.dataController.setDataManageSourceData(this.exeLoader.getSourceData())
      // this.dataController.setDataManageSegmentPool(this.exeLoader.getSegmentPool())
      this.state = state.PRELOADED_MP4
      this.events.emit(Events.LoaderMP4Loaded, this)
      if (typeof callback === 'function') {
        callback.call(this, data)
      }
    })
  }

  loadHLS(callback) {
    this.exeLoader.loadPlaylist( (data) => {
      if (!data) {
        this.logger.error('run', 'start load m3u8', 'data:', data)
        return
      }
      this.dataController.setHLSSourceData(this.exeLoader.getSourceData())
      this.dataController.setHLSSegmentPool(this.exeLoader.getSegmentPool())
      this.state = state.LOADED_PLAYLIST
      this.events.emit(Events.LoaderPlayListLoaded, this)
      if (typeof callback === 'function') {
        callback.call(this, data)
      }
    })
  }

  switchPlaylist(sourceURL, callback) {
    this.setSourceURL(sourceURL)
    this.dataController.clearDataManage()
    this.state = state.LOAD_PLAYLIST
    this.events.emit(Events.LoaderPlayListStart, this)
    this.logger.info('switchPlaylist', state[this.state], 'url:', sourceURL)
    this.loadHLS(callback)
  }

  setExeLoader(exeLoader) {
    this.exeLoader = exeLoader
  }

  getExeLoader() {
    return this.exeLoader
  }

  setSourceURL(url) {
    this.exeLoader.setSourceURL(url)
  }

  getSourceURL() {
    return this.exeLoader.getSourceURL()
  }

  setDataManage(dataManage) {
    this.dataManage = dataManage
  }

  getDataManage() {
    return this.dataManage
  }

  getSourceData() {
    return this.exeLoader.getSourceData()
  }
  destroy() {
    this.exeLoader.destroy()
  }
}

export default LoaderController