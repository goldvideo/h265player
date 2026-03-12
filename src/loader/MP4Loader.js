/**
 * Copyright (C) 2021.
 * All Rights Reserved.
 * @file MP4Loader
 * @desc
 * MP4 load module
 * @author Jarry
 */

import {
  BUFFER
} from '../config/Config'
import BaseLoader from './BaseLoader'
import {
  state
} from '../config/LoaderConfig'
import MP4Parser from '../toolkit/MP4Parser'
import SegmentPool from '../data/SegmentPool'
import SegmentModel from '../model/SegmentModel'
import Events from '../config/EventsConfig'
import Utils from '../utils/Utils'

class MP4Loader extends BaseLoader {
  state = state.IDLE

  maxBufferDuration = BUFFER.maxDuration
  maxBufferSize = BUFFER.maxSize
  baseUrl = ''

  options = null
  httpWorker = null
  mp4Meta = null
  mp4Parser = null
  sourceData = null
  // segmentPool should be immutability
  segmentPool = [ /* new SegmentModel */ ]

  currentNo = null
  maxRetryCount = BUFFER.maxRetryCount
  mp4Buffer = null
  mp4FileSize = 0

  constructor(options) {
    super()
    this.options = options
    this.loaderController = this.options.loaderController
    this.dataController = this.loaderController.dataController
    this.httpWorker = options.httpWorker
    this.setSegmentPool(new SegmentPool())

    // 绑定Worker消息处理器
    this.onWorkerMessage = this.handleWorkerMessage.bind(this)
    if (this.httpWorker) {
      this.httpWorker.addEventListener('message', this.onWorkerMessage)
    }
  }

  /**
   * 统一处理Worker消息
   */
  handleWorkerMessage(event) {
    const data = event.data
    const body = data.data

    if (!body) {
      const content = `Get the ${data.fileType} file error. URL: ${data.url}`
      this.events.emit(Events.PlayerAlert, content)
      this.events.emit(Events.LoaderError, content, data)
      const errors = [this.state, 'load mp4 error.', 'data:', data, content]
      this.events.emit(Events.PlayerThrowError, errors)
      return
    }

    // 处理预加载响应
    if (data.name === 'preloadmp4') {
      this.logger.info('handleWorkerMessage', 'receive mp4 header', 'size:', body.byteLength)
      this.handlePreloadResponse(data, body, this.preloadCallback)
    }
    // 处理分片加载响应
    else if (typeof data.name === 'number') {
      this.logger.info('handleWorkerMessage', 'read success', 'segment no:', data.name)
      this.state = state.IDLE
      this.events.emit(Events.LoaderLoaded, data, this.currentSegment, this.currentType, this.currentTime)
    }
    else {
      this.logger.warn('handleWorkerMessage', 'unknown response', 'data:', data)
    }
  }

  /**
   * 预加载MP4文件头，获取元数据
   */
  preload(callback) {
    this.logger.info('preload', 'start preload mp4 metadata', 'url:', this.sourceURL)

    // 保存回调供handleWorkerMessage使用
    this.preloadCallback = callback

    // 先请求文件头（0-256KB）来获取moov box信息
    this.httpWorker.postMessage({
      type: 'invoke',
      fileType: 'mp4',
      method: 'get',
      name: 'preloadmp4',
      url: this.sourceURL,
      options: {
        headers: {
          'Range': 'bytes=0-262143' // 256KB
        }
      }
    })
  }

  /**
   * 处理预加载响应
   */
  handlePreloadResponse(data, buffer, callback) {
    try {
      // 解析MP4元数据
      this.mp4Parser = new MP4Parser()

      if (!this.mp4Parser.parse(buffer)) {
        throw new Error('Failed to parse MP4 metadata')
      }

      const metadata = this.mp4Parser.getMetadata()
      this.logger.info('preload', 'MP4 metadata:', metadata)

      // 构建segment pool
      const segments = this.mp4Parser.getSegments()
      if (segments && segments.length > 0) {
        segments.forEach(seg => {
          const segmentModel = new SegmentModel(seg)
          this.segmentPool.push(segmentModel)
        })
        this.logger.info('preload', 'build segment pool:', segments.length)
      }

      // 保存元数据
      this.setSourceData({
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        videoTrack: metadata.videoTrack,
        audioTrack: metadata.audioTrack,
        segments: segments
      })

      if (typeof callback === 'function') {
        callback.call(this, this.sourceData)
      }

    } catch (error) {
      this.logger.error('preload', 'Parse error:', error)
      const content = `Parse MP4 file error: ${error.message}`
      this.events.emit(Events.PlayerAlert, content)
      this.events.emit(Events.LoaderError, content, error)
      const errors = [this.state, 'parse mp4 error.', error]
      this.events.emit(Events.PlayerThrowError, errors)
    }
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

  isNotFree(notice = '') {
    notice = '[' + notice + ']loader is not free. please wait.'
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
    // 检查分片号
    if (segment.no > this.segmentPool.length) {
      return false
    }

    // 安全地检查缓冲区时长
    const bufferPool = this.dataController.getMP4BufferPool()
    if (!bufferPool || !bufferPool.length) {
      return true  // 缓冲区为空，可以加载
    }

    // 计算缓冲区时长
    const bufferDuration = bufferPool[bufferPool.length - 1].end -
                           (bufferPool[0]?.start || 0)

    if (bufferDuration > this.maxBufferDuration) {
      this.logger.info('checkLoadCondition', 'buffer full',
        'duration:', bufferDuration, 'max:', this.maxBufferDuration)
      return false
    }

    return true
  }

  /**
   * 加载MP4分片
   * 支持HTTP Range请求按需加载
   * @param {SegmentModel} segment
   * @param {String} type [optional] 'seek' or 'play'
   * @param {Number} time [optional] millisecond
   */
  loadFile(segment, type, time) {
    if (!(segment instanceof SegmentModel)) {
      return
    }

    // 验证type
    if (!['play', 'seek', 'start'].includes(type)) {
      this.logger.warn('loadFile', 'invalid type:', type)
      type = 'play'
    }

    // 验证time
    if (typeof time !== 'number' || isNaN(time)) {
      time = 0
    }
    if (time < 0) {
      this.logger.warn('loadFile', 'negative time:', time)
      time = 0
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
    // 保存当前段、类型、时间供handleWorkerMessage使用
    this.currentSegment = segment
    this.currentType = type
    this.currentTime = time

    let retryCount = 1
    const url = this.options.sourceURL

    const _getRequestURL = (url, segment) => {
      if (typeof this.options.processURL == 'function') {
        return this.options.processURL(url, segment)
      }
      return url
    }

    const _send = () => {
      // MP4使用整个文件，无需Range请求分片
      this.httpWorker.postMessage({
        type: 'invoke',
        fileType: 'mp4',
        method: 'get',
        name: segment.no,
        url: _getRequestURL(url, segment),
        options: {
          headers: {
            // 可选：根据需要使用Range请求特定区域
            // 'Range': `bytes=${start}-${end}`
          }
        }
      })
    }

    this.state = state.LOADING
    this.events.emit(Events.LoaderLoading, segment, type, time)
    _send()
  }

  destroy() {
    // 移除事件监听器
    if (this.httpWorker && this.onWorkerMessage) {
      this.httpWorker.removeEventListener('message', this.onWorkerMessage)
    }

    // 清空回调
    this.preloadCallback = null

    // 清空数据
    this.mp4Parser = null
    this.sourceData = null
    this.segmentPool.length = 0

    // 终止Worker
    if (this.httpWorker) {
      this.httpWorker.terminate()
      this.httpWorker = null
    }
  }
}

export default MP4Loader