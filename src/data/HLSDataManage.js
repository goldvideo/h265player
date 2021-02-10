/**
 * @copyright: Copyright (C) 2019
 * @file DataManage
 * @desc
 * ts load and data format 
 * @author Jarry
 */

import BaseClass from '../base/BaseClass'
import BufferModel from '../model/BufferModel'
import BufferPool from './BufferPool'
import Events from '../config/EventsConfig'

class HLSDataManage extends BaseClass {

  bufferPool = [ /* new BufferModel */ ]
  sourceData = {}
  options = {}
  segmentPool = [ /* new SegmentModel */ ]

  readBufferNo = null
  startLoadTime = null
  currentSeekTime = null

  constructor(options = {}) {
    super()
    this.options = options
    this.init()
  }

  init() {
    this.setBufferPool(new BufferPool())
    this.events.on(Events.DataManageReadBufferByNo, (no, callback) => {
      this.readBufferByNo(no, callback)
    })
    this.events.on(Events.DataManageReadBuffer, (time, callback) => {
      this.readBuffer(time, callback)
    })
    this.events.on(Events.LoaderLoaded, (data, segment, type, time) => {
      // console.error('Events.LoaderLoaded', data, segment, time, this)
      const buffer = this.createBuffer({
        arrayBuffer: data.arrayBuffer
      }, segment)
      this.segmentLoaded(segment, buffer)
      if (type === 'seek' && time === this.currentSeekTime) {
        this.events.emit(Events.DataManageSeek, buffer, time)
        this.removeBufferByNo(buffer.no)
        return
      }
      if (time === this.startLoadTime) {
        this.events.emit(Events.DataManageFirstLoaded, buffer, time)
      }
    })
  }

  setOptions(options) {
    Object.assign(this.options, options)
  }

  startLoad(time = 0) {
    this.logger.info('startLoad', 'begin to load ts data', 'time:', time)
    if (isNaN(time)) {
      this.logger.error('seekTime', 'seek', 'time:', time)
      return
    }
    this.startLoadTime = time
    this.loadSegmentByTime(time, 'start')
  }

  readBuffer(time, callback) {
    const segment = this.getSegmentByTime(time)
    if (segment) {
      this.readBufferByNo(segment.no, callback)
    }
  }

  segmentLoaded(segment, buffer) {
    if (buffer) {
      this.addBufferPool(buffer)
    }
    if (segment.no === this.options.player.currentIndex) {
      this.readBufferByNo(segment.no)
    }
    if (segment.no < this.segmentPool.getLast().no) {
      this.loadSegmentByNo(segment.no + 1)
    }
  }

  seekTime(time) {
    if (isNaN(time)) {
      this.logger.error('seekTime', 'seek', 'time:', time)
      return
    }
    this.currentSeekTime = time
    let buffer
    const idx = this.bufferPool.indexOfByTime(time)
    if (idx > -1) {
      buffer = this.bufferPool[idx]
      this.events.emit(Events.DataManageSeek, buffer, time)
    } else {
      this.removeBufferPool(this.bufferPool.length)
      this.loadSegmentByTime(time, 'seek')
    }
  }


  loadSegmentByTime(time, type) {
    if (isNaN(time)) {
      return
    }
    const idx = this.segmentPool.indexOfByTime(time)
    if (idx >= 0) {
      const segment =  this.segmentPool[idx]
      this.events.emit(Events.LoaderLoadFile, segment, type, time)
    } else {
      this.logger.error('loadSegmentByTime', 'time over', 'time:', time, 'type:', type)
    }
  }

  createBuffer(data, segment) {
    if (!data) {
      return
    }
    const buffer = {
      start: segment.start,
      end: segment.end,
      no: segment.no,
      duration: segment.end - segment.start,
      // blob: data.blob,
      arrayBuffer: data.arrayBuffer
    }
    return new BufferModel(buffer)
  }

  isValidSegmentNo(no) {
    return !isNaN(no) && no > 0 && no <= this.segmentPool.length
  }

  loadSegmentByNo(no) {
    const idx = no - 1
    const segment = this.segmentPool.get(idx)
    if (!segment) {
      return
    }
    this.events.emit(Events.LoaderLoadFile, segment, 'play')
  }

  /**
   * get buffer from bufferPool and the blob will convert to arrayBuffer
   * @param {number} time 
   * @param {Function} callback [optional] 
   */
  readBufferByNo(no, callback) {
    if (!this.isValidSegmentNo(no)) {
      this.logger.error('readBufferByNo', 'check buffer no', 'is not valid no', no)
      return
    }
    this.readBufferNo = no
    callback = callback || function(buffer) {
      this.events.emit(Events.DataManageRead, buffer)
    }
    this.getBlobByNo(no, callback)
  }

  /**
   * get segment from segment by time
   * @param {number} time 
   */
  getSegmentByTime(time) {
    const idx = this.segmentPool.indexOfByTime(time)
    const segment = this.segmentPool[idx]
    return segment
  }

  getBlobByNo(no, callback) {
    if (isNaN(no)) {
      this.logger.error('getBlobByNo', 'isNaN', 'no:', no)
      return
    }
    if (this.isBufferReading) {
      this.logger.warn('getBlobByNo', 'isBufferReading', 'no:', no)
      return
    }
    let buffer
    this.isBufferReading = true
    buffer = this.bufferPool.getByKeyValue('no', no)[0]

    if (typeof callback == 'function') {
      callback.call(this, buffer)
      if (buffer) {
        this.removeBufferByNo(buffer.no)
      }
    }
    this.isBufferReading = false
    return buffer
  }

  addBufferPool(buffer) {
    if (this.bufferPool.length) {
      if (this.bufferPool[0].no === buffer.no + 1) {
        this.bufferPool.unshift(buffer)
        return true
      }
      const last = this.bufferPool.getLast()
      if ((buffer.no - last.no) === 1) {
        this.bufferPool.push(buffer)
        return true
      }
      if (this.bufferPool.indexOfByKey('no', buffer.no)) {
        return true
      }      
      this.bufferPool.splice(0, this.bufferPool.length)
    }
    this.bufferPool.push(buffer)
  }

  removeBufferPool(idx) {
    // let buffer = this.bufferPool.get(idx)
    // remove all segment before the time
    this.bufferPool.splice(0, idx + 1)
  }
  
  removeBufferByNo(no) {
    const idx = this.bufferPool.indexOfByKey('no', no)
    if (idx <= -1) {
      return
    }
    this.removeBufferPool(idx)

    if (this.bufferPool.length) {
      // while buffer pool is full to read, load next one after last
      if (this.bufferPool.getLast().no < this.segmentPool.getLast().no) {
        this.loadSegmentByNo(this.bufferPool.getLast().no + 1)
      }
    } else if (no < this.segmentPool.getLast().no) {
      this.loadSegmentByNo(no + 1)
    }
    return true
  }

  clear() {
    this.sourceData = {}
    this.readBufferNo = null
    this.currentSeekTime = null
    this.bufferPool.length = 0
    this.segmentPool.length = 0
  }

  getSegmentByNo(no) {
    // segmentPool is readonly data
    return this.segmentPool.get(no - 1)
  }

  getSegment(time) {
    return this.segmentPool.getByTime(time)
  }

  setSourceData(sourceData) {
    this.sourceData = sourceData
  }

  getSourceData() {
    return this.sourceData
  }

  setBufferPool(bufferPool) {
    this.bufferPool = bufferPool
  }

  getBufferPool() {
    return this.bufferPool
  }

  setSegmentPool(segmentPool) {
    this.segmentPool = segmentPool
  }

  getSegmentPool() {
    return this.segmentPool
  }

}

export default HLSDataManage
