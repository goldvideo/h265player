/**
 * @copyright: Copyright (C) 2019
 * @file Config.js
 * @desc
 * common config
 * @author Jarry
 */

// from webpack global variable 
// __ENV_MODEL__: "production" | "development" | "test"
const mode = typeof __ENV_MODE__ !== 'undefined' ? __ENV_MODE__ : 'none'

const Config = {
  projectName: 'GOLDPLAY',
  projectAbbreviation: 'GP',
  mode: mode,
  basePath: './',
  get distPath() {
    let path = ''
    if (this.mode == 'development') {
      path = '/dist/'
    } else if (this.mode == 'test') {
      path = '/dist/'
    }
    return path
  },
  get libPath() {
    return this.distPath + 'lib/'
  },
  hideBarBoxTime: 300,
  speedList: [
    {
      name: '0.5X',
      value: 0.5
    },
    {
      name: '1.0X',
      value: 1.0
    },
    {
      name: '1.5X',
      value: 1.5
    },
    {
      name: '2.0X',
      value: 2.0
    },
    {
      name: '3.0X',
      value: 3.0
    }
  ]
}

const BUFFER = {
  //单位秒，loader加载ts片段缓存
  maxDuration: 30,
  maxSize: 1024 * 1000 * 1000,
  maxRetryCount: 3
}

const ERROR_STATE = {
  success: 100,
  fail: 200,
  pending: 300,
  reject: 400
}

const ERROR_TYPE = {
  /** Errors from the net util. */
  NETWORK: 1,

  /** Errors parsing the Manifest. */
  MANIFEST: 2,

  /** Errors parsing or processing audio or video streams. */
  MEDIA: 3,

  /** Errors parsing or processing data source. */
  DATA: 4,

  /** Errors while Mux encounter unexpected error.  */
  MUX: 5,

  /** Errors processing drm system. */
  DRM: 6
}
const AV_TIME_BASE_Q = 1 / 90000
const READY = {
  READYBUFFERLENGTH: 1000,
  //the buffer max length, unit is millisecond
  MAXBUFFERLENGTH: 5000
}
const LIBFILES = ['ADTS.js', 'mux.js']
export {
  Config,
  ERROR_STATE,
  ERROR_TYPE,
  BUFFER,
  AV_TIME_BASE_Q,
  READY,
  LIBFILES
}