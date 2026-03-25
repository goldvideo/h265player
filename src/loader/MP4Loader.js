/**
 * Copyright (C) 2021.
 * All Rights Reserved.
 * @file MP4Loader
 * @desc
 * MP4 load module — range-based streaming
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

// Preload: first 1MB to get ftyp + moov
const PRELOAD_SIZE = 1 * 1024 * 1024
// Segment size for mdat splitting (~2MB per segment)
const SEGMENT_BYTES = 2 * 1024 * 1024

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
  segmentPool = [ /* new SegmentModel */ ]

  currentNo = null
  maxRetryCount = BUFFER.maxRetryCount
  mp4Buffer = null
  mp4FileSize = 0

  // Range loading state
  moovBuffer = null     // ArrayBuffer containing ftyp+moov (small, cached for reuse)
  segmentCache = new Map()  // segmentNo → ArrayBuffer

  constructor(options) {
    super()
    this.options = options
    this.loaderController = this.options.loaderController
    this.dataController = this.loaderController.dataController
    this.httpWorker = options.httpWorker
    this.setSegmentPool(new SegmentPool())

    this.onWorkerMessage = this.handleWorkerMessage.bind(this)
    if (this.httpWorker) {
      this.httpWorker.addEventListener('message', this.onWorkerMessage)
    }
  }

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
      this.logger.info('handleWorkerMessage', 'receive mp4 preload', 'size:', body.byteLength)
      this.handlePreloadResponse(data, body, this.preloadCallback)
    }
    // 处理分片加载响应
    else if (typeof data.name === 'number') {
      this.logger.info('handleWorkerMessage', 'segment loaded', 'no:', data.name)
      this.state = state.IDLE

      // Cache raw segment data
      this.segmentCache.set(data.name, data.arrayBuffer)

      this.events.emit(Events.LoaderLoaded, data, this.currentSegment, this.currentType, this.currentTime)
    }
    else {
      this.logger.warn('handleWorkerMessage', 'unknown response', 'data:', data)
    }
  }

  /**
   * Preload: small Range request for moov metadata only
   */
  preload(callback) {
    if (!this.sourceURL) {
      if (this.options && this.options.sourceURL) {
        this.sourceURL = this.options.sourceURL
      } else {
        const content = 'MP4 preload failed: sourceURL is empty'
        this.logger.error('preload', content)
        this.events.emit(Events.PlayerAlert, content)
        this.events.emit(Events.LoaderError, content, {})
        this.events.emit(Events.PlayerThrowError, [this.state, 'load mp4 error.', content])
        return
      }
    }

    this.logger.info('preload', 'start preload mp4 metadata', 'url:', this.sourceURL)
    this.preloadCallback = callback

    // Request only first 1MB — enough for ftyp + moov in most MP4 files
    this.httpWorker.postMessage({
      type: 'invoke',
      fileType: 'mp4',
      method: 'get',
      name: 'preloadmp4',
      url: this.sourceURL,
      options: {
        headers: {
          'Range': `bytes=0-${PRELOAD_SIZE - 1}`
        }
      }
    })
  }

  handlePreloadResponse(data, buffer, callback) {
    try {
      let mp4Buffer = null
      if (data.arrayBuffer && data.arrayBuffer.buffer instanceof ArrayBuffer) {
        mp4Buffer = data.arrayBuffer.buffer
      } else if (buffer instanceof ArrayBuffer) {
        mp4Buffer = buffer
      } else if (buffer && buffer.buffer instanceof ArrayBuffer) {
        mp4Buffer = buffer.buffer
      } else if (typeof Blob !== 'undefined' && buffer instanceof Blob) {
        buffer.arrayBuffer().then(arrBuf => {
          this.handlePreloadResponse(data, arrBuf, callback)
        }).catch(err => { throw err })
        return
      }

      if (!mp4Buffer || !(mp4Buffer instanceof ArrayBuffer)) {
        throw new Error('Invalid buffer: expected ArrayBuffer')
      }

      this.mp4Parser = new MP4Parser()

      if (!this.mp4Parser.parse(mp4Buffer)) {
        // moov not in first 1MB — retry with full file
        if (!this._retryingFull) {
          this.logger.info('preload', 'moov not found in first 1MB, loading full file')
          this._retryingFull = true
          this.httpWorker.postMessage({
            type: 'invoke',
            fileType: 'mp4',
            method: 'get',
            name: 'preloadmp4',
            url: this.sourceURL,
            options: { headers: {} }
          })
          return
        }
        throw new Error('Failed to parse MP4 metadata (moov box not found)')
      }

      this._retryingFull = false

      const metadata = this.mp4Parser.getMetadata()
      const mdatBox = this.mp4Parser.getMdatBox()
      const moovEnd = this.mp4Parser.getMoovEndOffset()

      this.logger.info('preload', 'metadata:', metadata,
        'moovEnd:', moovEnd, 'mdat:', mdatBox)

      // Cache moov region (ftyp + moov) for prepending to each segment
      // Use moovEnd to determine the exact size needed
      const moovSize = Math.min(moovEnd, mp4Buffer.byteLength)
      this.moovBuffer = mp4Buffer.slice(0, moovSize)

      // Build segment pool based on mdat byte ranges
      this.segmentPool = new SegmentPool()

      if (mdatBox && mdatBox.size > 0) {
        // Split mdat into ~2MB segments
        const mdatStart = mdatBox.offset
        const mdatEnd = mdatBox.offset + mdatBox.size
        const segmentSize = SEGMENT_BYTES
        const duration = metadata.duration
        const totalMdatSize = mdatBox.size
        let segNo = 1

        for (let byteOff = mdatStart; byteOff < mdatEnd; byteOff += segmentSize) {
          const segByteEnd = Math.min(byteOff + segmentSize - 1, mdatEnd - 1)
          // Estimate time range proportionally from byte position
          const startFrac = (byteOff - mdatStart) / totalMdatSize
          const endFrac = (segByteEnd + 1 - mdatStart) / totalMdatSize
          const startTime = startFrac * duration
          const endTime = endFrac * duration

          this.segmentPool.push(new SegmentModel({
            no: segNo,
            name: `segment_${segNo}`,
            start: startTime,
            end: endTime,
            duration: endTime - startTime,
            byteStart: byteOff,
            byteEnd: segByteEnd
          }))
          segNo++
        }
      } else {
        // Fallback: single full-file segment (no mdat info)
        this.segmentPool.push(new SegmentModel({
          no: 1,
          name: 'full',
          start: 0,
          end: metadata.duration,
          duration: metadata.duration
        }))
        this.maxBufferDuration = Math.max(this.maxBufferDuration, metadata.duration + 1)
      }

      this.logger.info('preload', 'segments:', this.segmentPool.length)

      this.setSourceData({
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        videoTrack: metadata.videoTrack,
        audioTrack: metadata.audioTrack,
        segments: this.segmentPool,
        moovBuffer: this.moovBuffer
      })

      if (typeof callback === 'function') {
        callback.call(this, this.sourceData)
      }

    } catch (error) {
      this.logger.error('preload', 'Parse error:', error)
      const content = `Parse MP4 file error: ${error.message}`
      this.events.emit(Events.PlayerAlert, content)
      this.events.emit(Events.LoaderError, content, error)
      this.events.emit(Events.PlayerThrowError, [this.state, 'parse mp4 error.', error])
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
    if (segment.no > this.segmentPool.length) {
      return false
    }

    const bufferPool = this.dataController.getMP4BufferPool()
    if (!bufferPool || !bufferPool.length) {
      return true
    }

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
   * Load MP4 segment via HTTP Range request
   */
  loadFile(segment, type, time) {
    if (!(segment instanceof SegmentModel)) {
      return
    }

    if (!['play', 'seek', 'start'].includes(type)) {
      type = 'play'
    }

    if (typeof time !== 'number' || isNaN(time)) {
      time = 0
    }
    if (time < 0) time = 0

    if (this.isNotFree() && type !== 'seek' && type !== 'start') {
      this.logger.warn('loadFile', 'is loading', 'segment:', segment, 'type:', type)
      return
    }

    if (!this.checkLoadCondition(segment)) {
      this.state = state.IDLE
      this.logger.warn('loadFile', 'checkLoadCondition failed')
      return
    }

    this.currentNo = segment.no
    this.currentSegment = segment
    this.currentType = type
    this.currentTime = time

    // Check segment cache first
    const cached = this.segmentCache.get(segment.no)
    if (cached) {
      this.logger.info('loadFile', 'cache hit, segment:', segment.no)
      this.state = state.IDLE
      const outData = { name: segment.no, fileType: 'mp4', arrayBuffer: cached }
      this.events.emit(Events.LoaderLoaded, outData, segment, type, time)
      return
    }

    const url = this.sourceURL || this.options.sourceURL
    const _getRequestURL = (url, segment) => {
      if (typeof this.options.processURL == 'function') {
        return this.options.processURL(url, segment)
      }
      return url
    }

    const headers = {}
    if (segment.byteStart > 0 || segment.byteEnd > 0) {
      headers['Range'] = `bytes=${segment.byteStart}-${segment.byteEnd}`
      this.logger.info('loadFile', 'Range:', headers['Range'], 'segment:', segment.no)
    }

    this.httpWorker.postMessage({
      type: 'invoke',
      fileType: 'mp4',
      method: 'get',
      name: segment.no,
      url: _getRequestURL(url, segment),
      options: { headers }
    })

    this.state = state.LOADING
    this.events.emit(Events.LoaderLoading, segment, type, time)
  }

  destroy() {
    if (this.httpWorker && this.onWorkerMessage) {
      this.httpWorker.removeEventListener('message', this.onWorkerMessage)
    }

    this.preloadCallback = null
    this.mp4Parser = null
    this.sourceData = null
    this.moovBuffer = null
    this.segmentCache.clear()
    this.segmentPool.length = 0

    if (this.httpWorker) {
      this.httpWorker.terminate()
      this.httpWorker = null
    }
  }
}

export default MP4Loader
