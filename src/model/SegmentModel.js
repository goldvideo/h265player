/**
 * @copyright: Copyright (C) 2019
 * @desc: Model ofr segment from TS/MP4
 * @author: liuliguo 
 * @file: SegmentModel.js
 */
import BaseModel from '../base/BaseModel.js'
class SegmentModel extends BaseModel {

  no = 0
  name = null
  duration = 0
  file = null
  start = 0
  end = 0
  
  constructor(data) {
    super(data)
    Object.assign(this, data)
  }

}

export default SegmentModel