/**
 * @copyright: Copyright (C) 2019
 * @file BufferPool.js
 * @desc buffer pool
 * @see
 * @author Jarry
 */


import BasePool from "../base/BasePool"
import BufferModel from "../model/BufferModel"
class BufferPool extends BasePool {
  // bufferDuration = 0
  // bufferSize = 0
  constructor(data) {
    super(data)
  }
  add(data) {
    if (!(data instanceof BufferModel)) {
      data = new BufferModel(data)
    }
    // keep the ASC order
    let len = this.length
    if (len === 0) {
      this.push(data)
      return
    }
    while(len--) {
      if (data.no <= this[len].no) {
        this.splice(len, 1, data)
        return
      }
    }
    this.push(data)
    return this
  }
	getBufferSize() {
    if (this.length <= 0) return 0
		return this.reduce((acc, item) => {
      if (isNaN(acc)) {
        acc = acc.blob.size
      }
      return acc + item.blob.size
    })
  }

  get bufferSize() {
    return this.getBufferSize()
  }

  getBufferDuration() {
    if (this.length <= 0) return 0
		return this.reduce((acc, item) => {
      if (isNaN(acc)) {
        acc = acc.end - acc.start
      }
      return acc + (item.end - item.start)
    })
  }

  get bufferDuration() {
    return this.getBufferDuration()
  }
  
}

export default BufferPool