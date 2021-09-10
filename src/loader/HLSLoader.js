/**
 * Copyright (C) 2019.
 * All Rights Reserved.
 * @file HLSLoader
 * @desc
 * hls load module
 * @author Jarry
 */

import { BUFFER } from '../config/Config'
import BaseLoader from './BaseLoader'
import { state } from '../config/LoaderConfig'
import { M3U8Parser } from '../toolkit/M3U8Parser'
import SegmentPool from '../data/SegmentPool'
import SegmentModel from '../model/SegmentModel'
import Events from '../config/EventsConfig'
import Utils from '../utils/Utils'

class HLSLoader extends BaseLoader {
  state = state.IDLE

  maxBufferDuration = BUFFER.maxDuration
  maxBufferSize = BUFFER.maxSize
  baseUrl = ''

  options = null
  httpWorker = null
  sourceData = null
  // segmentPool should be immutability
  segmentPool = [ /* new SegmentModel */ ]

  currentNo = null
  maxRetryCount = BUFFER.maxRetryCount

  constructor(options) {
    super()
    this.options = options
    this.loaderController = this.options.loaderController
    this.dataController = this.loaderController.dataController
    this.httpWorker = options.httpWorker
    this.setSegmentPool(new SegmentPool())
  }

  loadPlaylist(callback) {
    this.httpWorker.postMessage({
      type: 'invoke',
      fileType: 'm3u8',
      method: 'get',
      name: 'playlist',
      url: this.sourceURL
    })
    this.httpWorker.onmessage = (event) => {
      const data = event.data
      const body = event.data.data
      if (!body) {
        const content = `Get the ${data.fileType} file error. URL: ${data.url}`
        this.events.emit(Events.PlayerAlert, content)
        this.events.emit(Events.LoaderError, content, data)
        const errors = [this.state, 'request playlist error.', 'data:', data, content]
        this.events.emit(Events.PlayerThrowError, errors)
        return
      }
      if (data.name == 'playlist') {
        this.parsePlaylist(body, callback)
      }
    }
  }

  parsePlaylist(source, callback) {
    const data = new M3U8Parser(source)
    if (!data.segments || !data.segments.length) {
      this.events.emit(Events.LoaderError, data)
      this.events.emit(Events.PlayerAlert, 'Parse playlist file error.')
      const errors = [this.state, 'Parse playlist error.', 'data:', data]
      this.events.emit(Events.PlayerThrowError, errors)
      return
    }
    let segments = data.segments
    segments.forEach(item => {
      item.start = Utils.msec2sec(item.start)
      item.end = Utils.msec2sec(item.end)
      item.duration = Utils.msec2sec(item.duration)
    })
    this.setSourceData(Object.freeze(data))
    this.segmentPool.addAll(data.segments)
    callback.call(this, data)
  }

  setSourceData(sourceData) {
    this.sourceData = sourceData
  }

  getSourceData() {
    return this.sourceData
  }

  setSegmentPool(segmentPool) {
    this.segmentPool = segmentPool
  }

  getSegmentPool() {
    return this.segmentPool
  }

  isNotFree (notice = '') {
    notice = '[' + notice  + ']loader is not free. please wait.'
    if (this.state !== state.IDLE && this.state !== state.DONE) {
      this.logger.warn('isNotFree', 'check status for loader', 'notice:', notice)
      return true
    }
    return false
  }

  getBaseUrl(file) {
    const sourceURL = this.options.sourceURL
    const isAbsolute = file.indexOf('//') > -1
    if (!isAbsolute) {
      const lastSlash = sourceURL.lastIndexOf('/')
      return sourceURL.substr(0, lastSlash + 1)
    }
    return ''
  }

  checkLoadCondition(segment) {
    // over the pool range
    if (segment.no > this.segmentPool.length) {
      return false
    }
    // max duration limit
    if (this.dataController.getHLSBufferPool().bufferDuration > this.maxBufferDuration) {
      this.logger.info('checkLoadCondition', 'stop load next segment.',
      'bufferDuration:', this.dataController.getHLSBufferPool().bufferDuration, 'maxBufferDuration:', this.maxBufferDuration)
      return false
    }
    return true
  }

  /**
   * load ts file by segment
   * @param {Segment} segment 
   * @param {String} type [optional] 'seek' or 'play'
   * @param {Number} time [optional] millisecond
   */
  loadFile(segment, type, time) {
    if (!(segment instanceof SegmentModel)) {
      return
    }

    // only single load process
    if(this.isNotFree() && type !== 'seek' && type !== 'start') {
      this.logger.warn('loadFile', 'is loading', 'segment:', segment, 'type:', type)
      return
    }

    if (!this.checkLoadCondition(segment)) {
      this.state = state.IDLE
      this.logger.warn('loadFile', 'checkLoadCondition failed', 'segment:', segment, 'type:', type)
      return
    }

    this.currentNo = segment.no

    const baseUrl = this.getBaseUrl(segment.file)
    let url = baseUrl + segment.file
    let retryCount = 1

    const _getRequestURL = (url, segment) => {
      if (typeof this.options.processURL == 'function') {
        return this.options.processURL(url, segment)
      }
      return url
    }

    const _send = () => {
      this.httpWorker.postMessage({
        type: 'invoke',
        fileType: 'ts',
        method: 'get',
        name: segment.no,
        url: _getRequestURL(url, segment)
      })
    }

    this.state = state.LOADING
    this.events.emit(Events.LoaderLoading, segment, type, time)
    this.httpWorker.onmessage = (event) => {
      this.state = state.DONE
      const data = event.data
      this.logger.info('loadfile', 'httpWorker', 'onmessage get data')
      if (!data || data.type === 'error') {
        this.state = state.ERROR
        if (retryCount <= this.maxRetryCount) {
          this.logger.warn('loadFile', 'retry to load', 'count:', retryCount, 'segment:', segment)
          _send()
          retryCount += 1
        } else {
          this.events.emit(Events.LoaderError, segment, type, time)
          const content =  'Load file error, please concat administrator.'
          this.events.emit(Events.PlayerAlert, content)
          const errors = [this.state, 'Load File error.', 'load count:', retryCount, 'segment:', segment]
          this.events.emit(Events.PlayerThrowError, errors)
        }
      } else if (data.type === 'notice') {
          if (data.noticeType === 'speed') {
            this.events.emit(Events.LoaderUpdateSpeed, data.data)
          }
      } else if ((data.fileType === 'ts') && data.name === segment.no) {
        this.logger.info('loadFile', 'read success', 'data no:', data.name)
        this.state = state.IDLE
        this.events.emit(Events.LoaderLoaded, data, segment, type, time)
      } else {
        this.logger.warn('loadFile', 'is not ts file or the segment\'no is not equal.', 'fileType:', data.fileType, 'data:', data)
      }
    }
    _send()
  }
  destroy() {
    if (this.httpWorker) {
      this.httpWorker.terminate()
    }
  }
}

export default HLSLoader