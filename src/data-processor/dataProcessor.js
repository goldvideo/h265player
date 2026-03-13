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
    let mediaType = data.mediaType || 'ts' // 'ts' or 'mp4'

    console.log('[dataProcessor] Received message:', {
      type,
      mediaType,
      bufferByteLength: buffer?.byteLength,
      bufferType: buffer?.constructor?.name,
      isLast
    })

    switch (type) {
      case 'startDemux':
        console.log('[dataProcessor] Processing startDemux, mediaType:', mediaType)
        if (mediaType === 'mp4') {
          // MP4 demux
          console.log('[dataProcessor] Received MP4 data:', {
            bufferByteLength: buffer?.byteLength,
            bufferType: buffer?.constructor?.name,
            isLast: isLast
          })
          if (!self.mp4Demuxer) {
            console.log('[dataProcessor] Creating new MP4Demuxer with libPath:', workerLibPath)
            self.mp4Demuxer = new MP4Demux(self.decode, workerLibPath)
          }
          self.mp4Demuxer.isLast = isLast
          console.log('[dataProcessor] Calling MP4Demuxer.push with buffer size:', buffer?.byteLength)
          self.mp4Demuxer.push(buffer)
          console.log('[dataProcessor] MP4Demuxer.push completed')
        } else {
          // TS demux (default)
          console.log('[dataProcessor] Processing TS demux')
          self.demuxer.isLast = isLast
          self.demuxer.push(buffer)
        }
        break
      case 'loadwasm':
        console.log('[dataProcessor] Loading WASM from:', data.libPath)
        workerLibPath = data.libPath || ''
        self.decode.loadWASM(event)
        break
      case 'flush':
        console.log('[dataProcessor] Flushing decoder')
        self.decode.flush()
        break
      default:
        console.warn('[dataProcessor] Unknown message type:', type)
    }
  }
}

