/**
 * @copyright: Copyright (C) 2019
 * @desc: demux and decode 
 * @author: liuliguo 
 * @file: dataProcessorController.js
 */
import BaseClass from '../base/BaseClass.js'
import webworkify from 'webworkify-webpack'
import Events from '../config/EventsConfig'

export default class DataProcessorController extends BaseClass {
  isLast = false
  _moovSent = false
  constructor(options) {
    super(options)
    this.type = options.type
    // 规范化 libPath，确保 Worker importScripts 能拿到绝对路径
    this.libPath = options.libPath
    if (typeof window !== 'undefined' && this.libPath) {
      try {
        const abs = new URL(this.libPath, window.location.href).href
        this.libPath = abs.endsWith('/') ? abs : abs + '/'
      } catch (e) {
        // ignore, keep original
      }
    }
    this.player = options.player
    this.init()
  }
  init() {
    let type = this.type
    // TS和MP4都需要初始化Worker
    this.initNormalWorker()
    this.bindEvent()
    this.loadjs()
  }

  initNormalWorker() {
    this.processor = this.initWorker()
  }
  initWorker() {
    let processor = webworkify(require.resolve('./dataProcessor.js'))
    processor.onmessage = (event) => {
      let workerData = event.data
      let type = workerData.type
      let data = workerData.data
      switch (type) {
        case 'dataProcessorReady':
          this.onDataProcessorReady()
          break
        case 'decoded':
          this.onDecoded(data)
          break
        case 'demuxedAAC':
          this.onDemuxedAAC(data)
          break
        case 'partEnd':
            this.onPartEnd(data)
          break
        case 'resetEnd':
          this.onResetEnd()
          break
        case 'maxPTS':
          this.onMaxPTS(data)
          break
        case 'flushEnd':
          this.onFlushEnd(data)
          break
      }
    }
    return processor
  }
  bindEvent() {
    this.events.on(Events.DemuxStartDemux, this.onStartDemux.bind(this))
    this.events.on(Events.DemuxLast, () => {
      this.isLast = true
    })
    this.events.on(Events.DecodeFlush, () => {
      this.flush()
    })
  }
  flush() {
    this.processor.postMessage({
      type: 'flush'
    })
  }
  loadjs() {
    this.processor.postMessage({
      type: 'loadwasm',
      libPath: this.libPath
    })
  }
  reset() {
    this.isLast = false
    this._moovSent = false
    this.processor.postMessage({ type: 'reset' })
  }
  onFlushEnd(data) {
    this.events.emit(Events.DecodeFlushEnd, data)
  }
  onMaxPTS(data) {
    this.events.emit(Events.PlayerMaxPTS, data.maxAudioPTS, data.maxVideoPTS)
  }
  onDemuxedAAC(pes) {
    this.events.emit(Events.DemuxAAC, pes)
  }
  onDataProcessorReady() {
    if (this.player.seeking || this.player.reseting) {
      this.events.emit(Events.ProcessorResetEnd)
    } else {
      this.events.emit(Events.DataProcessorReady)
    }
  }
  onStartDemux(data) {
    if (this.player.reseting) {
      console.log('[DataProcessorController] Player is resetting, skipping demux')
      return
    }
    this.logger.info('onStartDemux', 'postMessage to demux')

    if (data && data.arrayBuffer) {
      const mediaType = this.player.options && this.player.options.type ? this.player.options.type.toLowerCase() : 'ts'

      // For MP4 range loading: send moov data to Worker first
      if (mediaType === 'mp4' && !this._moovSent) {
        const sourceData = this.player.dataController && this.player.dataController.getMP4SourceData()
        const moovBuffer = sourceData && sourceData.moovBuffer
        if (moovBuffer) {
          this.processor.postMessage({
            type: 'initMoov',
            data: moovBuffer,
            mediaType: 'mp4'
          })
          this._moovSent = true
        }
      }

      this.processor.postMessage({
        type: 'startDemux',
        data: data.arrayBuffer,
        byteStart: data.byteStart || 0,
        isLast: this.isLast,
        mediaType: mediaType
      })
    } else {
      this.logger.error('onStartDemux', 'data is null', 'data:', data)
      console.error('[DataProcessorController] onStartDemux: data or arrayBuffer is missing', {
        hasData: !!data,
        hasArrayBuffer: data ? !!data.arrayBuffer : false,
        dataKeys: data ? Object.keys(data) : []
      })
    }
  }
  onDecoded(data) {
    if (this.player.reseting) {
      return
    }
    this.events.emit(Events.DecodeDecoded, data)
  }
  onPartEnd(data) {
    this.events.emit(Events.DecodeApppendEnd, data)
  }
  onResetEnd() {
    this.events.emit(Events.ProcessorResetEnd)
  }
  destroy() {
    if (this.processor) {
      this.processor.terminate()
    }
  }
}
