/**
 * @copyright: Copyright (C) 2019
 * @desc: yuv data module
 * @author: liuliguo 
 * @file: ImageData.js
 */
import BaseClass from "../base/BaseClass.js";
import Events from '../config/EventsConfig'
export default class ImageData extends BaseClass{
  maxBufferLength = 0
  duration = 0
  pool = []
  start = 0
  end = 0
  offset = 0
  fps = 25
  constructor(options) {
    super(options)
    this.maxBufferLength = options.maxBufferLength
  }
  push(data) {
    let pool = this.pool
    let length = pool.length

    if (length === 0) {
      this.offset = data.pts
      this.start = data.pts
      this.fps = data.fps
    }
    // Default duration for newly inserted frame (used if no successor exists yet)
    if (!data.duration) {
      data.duration = this.fps ? Math.ceil(1000 / this.fps) : 40
    }
    let index = this.insertSort(pool, data)
    if (pool[index - 1]) {
      pool[index -1].duration = pool[index].pts - pool[index -1].pts
    }
    if (pool[index + 1]) {
      pool[index].duration = pool[index + 1].pts - pool[index].pts
    }
    this.end = this.pool[length].pts + this.pool[length].duration
    this.duration = this.end - this.start
  }
  insertSort(array, value) {
    let length = array.length
    if (length === 0) {
      array.push(value)
      return 0
    }
    for (let i = 0; i < length; i++) {
      if (value.pts < array[i].pts) {
        let j = length
        while (j > i) {
          array[j] = array[j - 1]
          j--
        }
        array[i] = value
        return i
      }
    }
    array.push(value)
    return array.length - 1
  }
  reset() {
    this.duration = 0
    this.pool = []
    this.start = 0
    this.end = 0
    this.offset = 0
  }
  findByIndex(index) {
    let length = this.buffer.length
    if (index < length) {
      this.currentIndex = index
      return this.buffer[index]
    } else {
      this.logger.error(
        `input index ${index}is not found, current maxIndex is ${length - 1}`
      )
      return null
    }
  }
  find(time) {
    let pool = this.pool
    let length = pool.length
    if (!this.isBuffered(time)) {
      return
    }
    if (length === 0) {
      return
    }
    let index = this.findIndex(time)
    if (index !== -1) {
      let image = pool[index]
      this.checkBuffer(time)
      return image
    }
    index = this.findNearestIndex(time)
    if (index !== -1) {
      let image = pool[index]
      this.checkBuffer(image.pts)
      return image
    }
    return
  }
  findIndex(time) {
    let pool = this.pool
    let index = pool.findIndex(function(value) {
      let pts = parseInt(value.pts)
      return time >= pts && time < pts + value.duration
    })
    return index
  }
  findNearestIndex(time) {
    let pool = this.pool
    let length = pool.length
    if (!length) {
      return -1
    }
    for (let i = length - 1; i >= 0; i--) {
      if (time >= parseInt(pool[i].pts)) {
        return i
      }
    }
    return 0
  }
  getNearestTime(time) {
    let index = this.findIndex(time)
    if (index !== -1) {
      return this.pool[index].pts
    }
    index = this.findNearestIndex(time)
    if (index !== -1) {
      return this.pool[index].pts
    }
    return time
  }
  isBuffered(time) {
    return time >= this.start && time < this.end
  }
  checkBuffer(time) {
    let duration = this.duration
    let maxBufferLength = this.maxBufferLength
    if (duration > maxBufferLength) {
      if (time > this.start) {
        let index = this.findIndex(time)
        if (index === -1) {
          index = this.findNearestIndex(time)
        }
        if (index <= 0) {
          return false
        }
        let reduceBuffer = this.pool.splice(0, index)
        reduceBuffer.forEach((item) => {
          item = null
        })
        reduceBuffer = null
        this.start = this.pool[0].pts
        this.duration = this.end - this.start
        this.events.emit(Events.ImagePlayerBuffeUpdate)
      }
      return false
    } else {
      this.events.emit(Events.PlayerLoadNext)
    }
    return true
  }
  buffer() {
    return {
      start: this.start,
      end: this.end
    }
  }
}
