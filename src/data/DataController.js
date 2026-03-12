/**
 * @copyright: Copyright (C) 2019
 * @file DataController.js
 * @desc data controller
 * @see
 * @author Jarry
 */

import HLSDataManage from './HLSDataManage'
import MP4DataManage from './MP4DataManage'
import BaseController from '../base/BaseController'

export class DataController extends BaseController {
  type = null
  dataManage = null
  hlsDataManage = null
  mp4DataManage = null
  constructor(options = {}) {
    super()
    // 默认类型为 HLS，避免 type 未定义时调用 toUpperCase 报错
    this.options = Object.assign({ type: 'HLS' }, options)
    this.type = this.options.type || 'HLS'
  }

  setDataManage(options) {
    const sourceType = (options.type || 'HLS').toUpperCase()
    switch (sourceType) {
      case 'HLS':
        this.setHLSDataManage(options)
        this.dataManage = this.hlsDataManage
        break
      case 'MP4':
        this.setMP4DataManage(options)
        this.dataManage = this.mp4DataManage
        break
    }
  }

  setHLSDataManage(...args) {
    this.hlsDataManage = new HLSDataManage(...args)
  }

  setMP4DataManage(...args) {
    this.mp4DataManage = new MP4DataManage(...args)
  }

  getHLSDataManage(...args) {
    if (this.hlsDataManage == null) {
      this.setHLSDataManage(args)
    }
    return this.hlsDataManage
  }

  getMP4DataManage(...args) {
    if (this.mp4DataManage == null) {
      this.setMP4DataManage(...args)
    }
    return this.mp4DataManage
  }

  getMP4BufferPool() {
    return this.mp4DataManage.bufferPool
  }

  getHLSBufferPool() {
    return this.hlsDataManage.bufferPool
  }

  setHLSSourceData(sourceData) {
    this.hlsDataManage.setSourceData(sourceData)
  }

  setHLSSegmentPool(segmentPool) {
    this.hlsDataManage.setSegmentPool(segmentPool)
  }

  setMP4SourceData(sourceData) {
    if (this.mp4DataManage) {
      this.mp4DataManage.setSourceData(sourceData)
    }
  }

  setMP4SegmentPool(segmentPool) {
    if (this.mp4DataManage) {
      this.mp4DataManage.setSegmentPool(segmentPool)
    }
  }

  getMP4SourceData() {
    return this.mp4DataManage ? this.mp4DataManage.getSourceData() : null
  }

  getMP4SegmentPool() {
    return this.mp4DataManage ? this.mp4DataManage.getSegmentPool() : []
  }

  startLoad(startTime) {
    startTime = Math.max(startTime, 0)
    const sourceType = (this.type || 'HLS').toUpperCase()
    switch (sourceType) {
      case 'HLS':
        this.hlsDataManage.startLoad(startTime)
        break
      case 'MP4':
        this.mp4DataManage.startLoad(startTime)
        break
      default:
        this.logger.error('startLoad', 'type error', this.type)
    }
  }

  clearDataManage() {
    if (this.dataManage && this.dataManage.clear) {
      this.dataManage.clear()
    }
  }

  getDataManage(type, ...args) {
    const sourceType = (type || this.type || 'HLS').toUpperCase()
    switch (sourceType) {
      case 'HLS':
        return this.getHLSDataManage()
      case 'MP4':
        return this.getMP4DataManage()
    }
  }
}
export default DataController
