/**
 * Copyright (C) 2019.
 * All Rights Reserved.
 * @file M3U8Parser.js
 * @desc
 * m3u8 parse tool
 * @see
 * https://github.com/videojs/m3u8-parser/
 * https://github.com/mixer/m3u8-js/blob/master/parser.js
 * https://github.com/uupaa/M3U8.js/blob/master/lib/M3U8.js
 * @author Jarry
 */

import Logger from "./Logger"
import {
  throwError
} from "../error/ThrowError"

let logger = Logger.get('M3U8Parser.js', {
  level: 2
})

const matchers = {
  lineDelimiter: /\r?\n/,
  extensionHeader: '#EXTM3U',
  tagPrefix: '#EXT',
  segmentPrefix: '#EXTINF',
  segmentParse: /^#EXTINF: *([0-9.]+)(, *(.+?)?)?$/,
  tagParse: /^#EXT-X-([A-Z-]+)(:(.+))?$/,
  version: 'VERSION',
  allowCache: 'ALLOW-CACHE',
  combined: 'COMBINED',
  endList: 'ENDLIST',
  targetDuration: 'TARGETDURATION',
  mediaSequence: 'MEDIA-SEQUENCE',
  discontinuity: 'DISCONTINUITY',
  streamInf: 'STREAM-INF',
  isComment: (line) => line && line[0] === '#' && !(line.startsWith(matchers.tagPrefix)),
  isBlank: (line) => line === '',
  canStrip: (line) => matchers.isBlank(line) || matchers.isComment(line)
}

const STATE = {
  READING: 0,
  ADD_FILE: 1
}

const segment = {
  file: undefined,
  name: undefined,
  start: 0,
  end: 0,
  discontinuity: undefined,
  duration: undefined
}

export class M3U8Parser {
  source = ''
  segments = []
  _currentSegment = null
  discontinuous = null
  tags = {
    VERSION: undefined,
    TARGETDURATION: undefined
  }
  _state = null
  constructor(source, options = {}) {
    this.source = source
    this.options = options
    this.parse(this.source)
  }

  readSegment(line) {
    let parsed = matchers.segmentParse.exec(line)
    if (parsed === null) {
      logger.warn('readsegment', 'read segment failed', 'line:', line)
      return
    }
    let duration = parseFloat(parsed[1], 10)
    let name = parsed[3]
    if (duration % 1 !== 0) {
      if (this.tags.VERSION >= 3) {
        logger.info('readsegment', 'Version must be 3 or higher to support floating.', 'duration:', duration)
      }
    }
    if (duration < this.tags.TARGETDURATION) {
      logger.info('readsegment', 'Segment duration must be less than the TARGETDURATION', 'duration:', duration)
    }

    duration = duration * 1000
    this._currentSegment = Object.assign({}, segment, {
      duration: duration,
      name: name,
      discontinuity: this.discontinuous
    })

    const lastSegement = this.segments[this.segments.length - 1] || {
      start: 0,
      end: 0
    }
    this._currentSegment.start = lastSegement.end
    this._currentSegment.end = lastSegement.end + duration
    this.discontinuous = false
    this._state = STATE.ADD_FILE
  }

  readTag(line) {
    let parsed = matchers.tagParse.exec(line)
    if (parsed !== null) {
      return {
        name: parsed[1],
        value: parsed[3]
      }
    }
  }

  readLine(line) {
    if (line.startsWith(matchers.segmentPrefix)) {
      return this.readSegment(line)
    }

    let tag = this.readTag(line)
    if (!tag) {
      return
    }
    switch (tag.name) {
      case matchers.version:
        this.tags.VERSION = parseFloat(tag.value, 10)
        break
      case matchers.mediaSequence:
        this.tags.MEDIA_SEQUENCE = parseFloat(tag.value, 10)
        break
      case matchers.allowCache:
        this.tags.ALLOW_CACHE = /\s*(YES|yes)\s*/.test(tag.value) ? true : false
        break
      case matchers.discontinuity:
        this.tags.DISCONTINUITY = true
        this.discontinuous = true
        break
      case matchers.targetDuration:
        this.tags.TARGETDURATION = parseFloat(tag.value, 10)
        break
      case matchers.combined:
        this.tags.COMBINED = tag.value
        break
      case matchers.streamInf:
        this.tags.STREAM_INF = tag.value
        break
      case matchers.endList:
        this.tags.ENDLIST = 'EOF'
        break
      default:
        logger.warn('readLine', 'unknow line', 'line:', line)
    }
  }

  addFile(line) {
    if (line[0] === '#') {
      let tag = this.readTag(line)
      switch (tag.name) {
        case 'PROGRAM-DATE-TIME': {
          let time = new Date(tag.value)
          this._currentSegment.time = time
          break
        }
        default:
          logger.warn('addFile', 'Invalid tag.', 'tag.name:', tag.name)
      }
      return
    }

    this._currentSegment.file = line
    let sd = this.parseSDParam(line)
    if(sd >= 0) {
      // 根据sd的数据（本段起始毫秒数）修正 start,duration,end, 本段duration待下段修正
      this._currentSegment.start = sd
      this._currentSegment.end = sd + this._currentSegment.duration
      let lastSegement = this.segments[this.segments.length - 1] || { sd: 0, start: 0, end: 0 }
      lastSegement.duration = sd - lastSegement.start
      lastSegement.end = sd
    }
    if (!this._currentSegment.name) {
      this._currentSegment.name = line.substr(Math.max(0, line.lastIndexOf('/')), line.lastIndexOf('.'))
    }
    this.segments.push(this._currentSegment)
    this._state = STATE.READING
  }

  parseSDParam(line) {
    let result = -1
    let url
    try {
      url = new URL(line)
      let sd = url.searchParams.get('sd')
      
      if(sd) {
        result = parseInt(sd, 10)
      }
    } catch(e) {
      // Fail to parse url
    }
    return result
  }

  parse(source) {
    source = source || this.source
    if (typeof source !== 'string') {
      throwError('m3u8 file is not text.', source)
      return
    }
    this._state = STATE.READING
    this.discontinuous = false
    let lines = source.split(matchers.lineDelimiter)
    if (lines[0] != matchers.extensionHeader) {
      logger.error('parse', 'it is not a valid  m3u8 header', 'header:', lines[0])
      return
    }

    lines.forEach((line) => {
      if (matchers.canStrip(line)) {
        return
      }
      switch (this._state) {
        case STATE.READING:
          this.readLine(line)
          break
        case STATE.ADD_FILE:
          this.addFile(line)
          break
        default:
          throwError('parsing m3u8 get an error, it is unknow state.')
      }
    })
    return this
  }

  get version() {
    return this.tags.VERSION
  }

  get duration() {
    if (!this.segments.length) {
      return 0
    }
    return this.segments.reduce((acc = 0, current) => {
      let total = typeof acc == 'number' ? acc : acc.duration
      return total + current.duration
    })
  }

  get targetDuration() {
    return this.tags.TARGETDURATION
  }

  get mediaSequence() {
    return this.tags.MEDIA_SEQUENCE
  }

  get allowCache() {
    return this.tags.ALLOW_CACHE
  }

  get length() {
    return this.segments.length
  }

}

/**
 * output from Parser
 * @usage
 * m3u8parse(source).segments
 */
let instance = null
const m3u8parse = function (source, options) {
  if (!instance) {
    return new M3U8Parser(source, options)
  }
}

export default m3u8parse
