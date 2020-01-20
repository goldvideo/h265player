/**
 * @copyright: Copyright (C) 2019
 * @file DataController.js
 * @desc data controller
 * @see
 * @author Jarry
 */

import LoadData from './LoadData'
import BaseController from '../base/BaseController'

export class DataController extends BaseController {
  loadData = null
  constructor(options) {
    super()
    this.options = options
  }

  setLoadData(...args) {
    this.loadData = new LoadData(...args)
  }

  getLoadData() {
    return this.loadData
  }

  getLoadDataBufferPool() {
    return this.loadData.bufferPool
  }

  setLoadDataSourceData(sourceData) {
    this.loadData.setSourceData(sourceData)
  }

  setLoadDataSegmentPool(segmentPool) {
    this.loadData.setSegmentPool(segmentPool)
  }

  startLoad(startTime) {
    startTime = Math.max(startTime, 0)
    this.startLoadData(startTime)
  }

  startLoadData(startTime) {
    this.loadData.startLoad(startTime)
  }

  clearLoadData() {
    this.loadData.clear()
  }

  getDataInstance(type, ...args) {
    if (!type) {
      return
    }
    switch (type) {
      case 'load': {
        if (!this.loadData) {
          this.setLoadData(...args)
        }
        return this.loadData
      }
      default: {
        return null
      }
    }
  }
}
export default DataController
