/**
 * Copyright (C) 2019.
 * All Rights Reserved.
 * @file Loader.js
 * @desc
 * base module of load data
 * @author Jarry
 */

import BaseClass from '../base/BaseClass.js'

class BaseLoader extends BaseClass {
  dataManage = null
  sourceURL = ''
  constructor() {
    super()
  }
  init() {}

  setDataManage(dataManage) {
    this.dataManage = dataManage
  }

  setSourceURL(url) {
    this.sourceURL = url
  }

  getDataManage() {
    return this.getDataManage
  }

  getSourceURL() {
    return this.getSourceURL
  }

}

export default BaseLoader