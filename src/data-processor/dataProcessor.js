/**
 * @copyright: Copyright (C) 2019
 * @desc: demux and decode ts packet
 * @author: liuliguo 
 * @file: dataProcessor.js
 */

import Decode from '../decode/Decode.js'
import TsDemux from '../demux/TsDemux.js'

self.decode = new Decode()

self.demuxer = new TsDemux(self.decode)

export default self => {
  self.onmessage = function(event) {
    let data = event.data
    let type = data.type
    let buffer = data.data
    let isLast = data.isLast
    switch (type) {
      case 'startDemux':
        self.demuxer.isLast = isLast
        self.demuxer.push(buffer)
        break
      case 'loadwasm':
        self.decode.loadWASM(event)
        break
      case 'flush':
        self.decode.flush()
        break
    }
  }
}
