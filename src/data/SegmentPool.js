/**
 * @copyright: Copyright (C) 2019
 * @desc: segment pool
 * @author: Jarry
 * @file: SegmentPool.js
 */

import Utils from "../utils/Utils"
import BasePool from "../base/BasePool"
import SegmentModel from '../model/SegmentModel'

class SegmentPool extends BasePool {

  constructor(data) {
    super(data)
  }
  add(data) {
    if (!(data instanceof SegmentModel)) {
      data = new SegmentModel(data)
    }
    // the number begin in 1
    data.no = this.length + 1
    if (Utils.isObject(data)) {
      this.push(data)
    }
  }
}

export default SegmentPool