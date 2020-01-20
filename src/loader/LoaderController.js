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
import { state } from '../config/LoaderConfig'
import Events from '../config/EventsConfig'

const LoadersEnum = {
  // HLS, MP4, DASH
  'HLS': HLSLoader
}

class LoaderController extends BaseController {

  state = null
  exeLoader = null
  loadData = null
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
    if (this.player.loadData) {
      this.setLoadData(this.player.loadData)
    } else {
      this.setLoadData(this.dataController.getDataInstance('load', options))
    }
    this.exeLoader.setLoadData(this.loadData)
  }

  run() {
    this.state = state.LOAD_PLAYLIST
    this.events.emit(Events.LoaderPlayListStart, this)
    this.logger.info('run', state[this.state], 'url:', this.options.sourceURL)
    this.loadPlaylist()
  }

  bindEvent() {
    this.events.on(Events.LoaderLoadFile, (segment, type, time) => {
      this.exeLoader.loadFile(segment, type, time)
    })
  }

  loadPlaylist(callback) {
    this.exeLoader.loadPlaylist( (data) => {
      if (!data) {
        this.logger.error('run', 'start load m3u8', 'data:', data)
        return
      }
      this.dataController.setLoadDataSourceData(this.exeLoader.getSourceData())
      this.dataController.setLoadDataSegmentPool(this.exeLoader.getSegmentPool())
      this.state = state.LOADED_PLAYLIST
      this.events.emit(Events.LoaderPlayListLoaded, this)
      if (typeof callback === 'function') {
        callback.call(this, data)
      }
    })
  }

  switchPlaylist(sourceURL, callback) {
    this.setSourceURL(sourceURL)
    this.dataController.clearLoadData()
    this.state = state.LOAD_PLAYLIST
    this.events.emit(Events.LoaderPlayListStart, this)
    this.logger.info('switchPlaylist', state[this.state], 'url:', sourceURL)
    this.loadPlaylist(callback)
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

  setLoadData(loadData) {
    this.loadData = loadData
  }

  getLoadData() {
    return this.loadData
  }

  getSourceData() {
    return this.exeLoader.getSourceData()
  }
  destroy() {
    this.exeLoader.destroy()
  }
}

export default LoaderController