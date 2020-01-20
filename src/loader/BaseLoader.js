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
  loadData = null
  sourceURL = ''
  constructor() {
    super()
  }
  init() {}

  setLoadData(loadData) {
    this.loadData = loadData
  }

  setSourceURL(url) {
    this.sourceURL = url
  }

  getLoadData() {
    return this.getLoadData
  }

  getSourceURL() {
    return this.getSourceURL
  }

}

export default BaseLoader