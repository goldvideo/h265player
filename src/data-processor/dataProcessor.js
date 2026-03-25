/**
 * @copyright: Copyright (C) 2019
 * @desc: demux and decode ts packet or mp4 packet
 * @author: liuliguo
 * @file: dataProcessor.js
 */

import Decode from '../decode/Decode.js'
import TsDemux from '../demux/TsDemux.js'
import MP4Demux from '../demux/MP4Demux.js'

self.decode = new Decode()

// 根据媒体类型创建对应的demuxer
self.demuxer = new TsDemux(self.decode)
self.mp4Demuxer = null

let workerLibPath = ''

export default self => {
  self.onmessage = function(event) {
    let data = event.data
    let type = data.type
    let buffer = data.data
    let isLast = data.isLast
    let mediaType = data.mediaType || 'ts'

    switch (type) {
      case 'startDemux':
        if (mediaType === 'mp4') {
          if (!self.mp4Demuxer) {
            self.mp4Demuxer = new MP4Demux(self.decode, workerLibPath)
          }
          self.mp4Demuxer.isLast = isLast
          self.mp4Demuxer.push(buffer)
        } else {
          self.demuxer.isLast = isLast
          self.demuxer.push(buffer)
        }
        break
      case 'loadwasm':
        workerLibPath = data.libPath || ''
        self.decode.loadWASM(event)
        break
      case 'flush':
        self.decode.flush()
        break
      case 'reset':
        // 1. Cancel old mp4Demuxer's async processBatch chain FIRST
        //    to prevent it from feeding stale data to the reset decoder
        if (self.mp4Demuxer) {
          self.mp4Demuxer.cancelled = true
        }
        // 2. Reset decoder (close + reopen, WASM Module stays loaded)
        self.decode.reset()
        // 3. Create fresh mp4Demuxer instance (mp4box.iife.js already
        //    in global scope, ensureMP4Box() will skip importScripts)
        if (self.mp4Demuxer) {
          self.mp4Demuxer = new MP4Demux(self.decode, workerLibPath)
        }
        // 4. Reset TS demuxer
        if (self.demuxer) {
          self.demuxer = new TsDemux(self.decode)
        }
        break
    }
  }
}
