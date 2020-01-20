/**
 * @copyright: Copyright (C) 2019
 * @desc: arraybuffer Model from segment
 * @author: liuliguo 
 * @file: BufferModel.js
 */
import BaseModel from '../base/BaseModel.js'
class BufferModel extends BaseModel {
  no = 0
  start = 0
  end = 0
  blob = null
  arrayBuffer = null
  duration = 0
  constructor(data) {
    super(data)
    Object.assign(this, data)
  }

  get size() {
    return this.blob.size
  }

}

export default BufferModel