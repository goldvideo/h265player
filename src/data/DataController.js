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
  constructor(options) {
    super()
    this.options = options
    this.type = this.options.type || 'HLS'
  }

  setDataManage(options) {
    switch (options.type.toUpperCase()) {
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
      this.mp4DataManage(args)
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

  startLoad(startTime) {
    startTime = Math.max(startTime, 0)
    switch (this.type.toUpperCase()) {
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
    this.dataManage.clear()
  }

  getDataManage(type, ...args) {
    if (!type) {
      return
    }
    switch (type.toUpperCase()) {
      case 'HLS':
        return this.getHLSDataManage()
      case 'MP4':
        return this.getMP4DataManage()
    }
  }
}
export default DataController