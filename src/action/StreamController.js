/**
 * @copyright: Copyright (C) 2019
 * @desc: the player main stream controller, start demux and decode, load next ts packet
 * @author: liuliguo 
 * @file: StreamController.js
 */

import BaseClass from '../base/BaseClass'
import Events from '../config/EventsConfig'
export default class StreamController extends BaseClass {
  currentIndex = null
  retryTime = 0
  dataReady = { audioReady: false, imageReady: false }
  hasInit = false
  dataManageStatus = 'loading'
  duration = 0
  tsNumber = 0
  constructor(options) {
    super(options)
    this.dataManage = options.dataManage
    this.imagePlayer = options.imagePlayer
    this.audioPlayer = options.audioPlayer
    this.player = options.player
    this.bindEvent()
  }
  bindEvent() {
    this.events.on(Events.DataManageRead, (data) => {
      this.onRead(data)
    })
    this.events.on(Events.DemuxVideo, (data, isLast) => {
      this.onVideoDemuxed(data, isLast)
    })
    this.events.on(Events.DemuxAAC, (data) => {
      this.onAACDemuxed(data)
    })
    this.events.on(Events.DecodeDecoded, (data) => {
      this.onDecoded(data)
    })
    this.events.on(Events.DecodeApppendEnd, (data) => {
      this.onAppendEnd(data)
    })
    this.events.on(Events.ImagePlayerReady, () => {
      this.logger.info('bindevent', 'Events.ImagePlayerReady')
      this.checkDataReady('imageReady')
    })
    this.events.on(Events.AudioPlayerDataReady, () => {
      this.logger.info('bindevent', 'Events.AudioPlayerDataReady')
      this.player.receiveAACTime = null
      this.checkDataReady('audioReady')
    })
    this.events.on(Events.AudioPlayerWait, () => {
      this.dataReady.audioReady = false
      this.events.emit(Events.PlayerWait, 'audioPlayer')
    })
    this.events.on(Events.ImagePlayerWait, () => {
      this.dataReady.imageReady = false
      // If all segments have been loaded and decoded, no more data will come.
      // Treat this as end of video instead of waiting indefinitely.
      if (this.currentIndex >= this.tsNumber && this.imagePlayer.maxPTS !== null) {
        this.events.emit(Events.PlayerEnd)
        return
      }
      this.events.emit(Events.PlayerWait, 'imagePlayer')
    })
    this.events.on(Events.ImagePlayerEnd, () => {
      this.logger.info('bindevent', '........imageplayer end')
      this.events.emit(Events.PlayerEnd)
    })
    this.events.on(Events.PlayerWait, () => {
      // Don't override 'end' status — audio waiting can fire after video ends
      if (this.player.status === 'end') {
        return
      }
      this.logger.warn('player status wait')
      this.player.status = 'wait'
      if (this.dataManageStatus === 'loadend') {
        this.dataManageStatus = 'loading'
        this.loadNext()
      }
    })
    this.events.on(Events.PlayerLoadNext, () => {
      if (this.dataManageStatus === 'loadend') {
        this.dataManageStatus = 'loading'
        this.loadNext()
      }
    })
    this.events.on(Events.DecodeFlushEnd, (data) => {
      this.logger.info('flushend>>>>>>>>>>>>>>>', data)
      this.imagePlayer.maxPTS = data
      // If player is already waiting (all frames consumed before flush completed),
      // check if we're past the end and trigger end event
      if (this.player.status === 'wait' && data > 0) {
        if (this.player.currentTime >= data) {
          this.events.emit(Events.PlayerEnd)
        } else {
          // All frames decoded but remaining buffer < READYBUFFERLENGTH,
          // so ImagePlayerReady never fired. Force data ready to resume playback.
          this.checkDataReady('imageReady')
        }
      }
    })
  }
  checkDataReady(type) {
    let dataReady = this.dataReady
    dataReady[type] = true
    let keys = Object.keys(dataReady)
    let num = 0
    for (let i = 0; i < keys.length; i++) {
      if (!dataReady[keys[i]]) {
        break
      } else {
        num++
      }
    }
    if (num == keys.length) {
      this.events.emit(Events.StreamDataReady)
    }
  }
  setBaseInfo(info) {
    this.duration = info.duration
    this.tsNumber = info.tsNumber
  }
  reset() {
    this.dataReady = { audioReady: false, imageReady: false }
    this.currentIndex = null
    this.dataManageStatus = 'loading'
  }
  startLoad(index) {
    this.logger.info('startLoad', 'index:', index)
    this.currentIndex = index
    this.player.currentIndex = index
    this.events.emit(Events.DataManageReadBufferByNo, index)
  }
  loadNext() {
    if (this.player.reseting) {
      return
    }
    if (this.currentIndex >= this.tsNumber) {
      this.logger.info('loadNext', 'load end', 'currentIndex',this.currentIndex, 'tsNumber:', this.tsNumber)
      return
    }
    this.currentIndex += 1
    this.player.currentIndex = this.currentIndex
    this.logger.info('loadNext', 'load next ts', 'tsno:', this.currentIndex)
    this.events.emit(Events.DataManageReadBufferByNo, this.currentIndex)

  }
  onDecoded(dataArray) {
    dataArray.forEach((data) => {
      if (this.player.reseting) {
        return
      }
      if (data.pts >= this.player.currentTime) {
        this.imagePlayer.push(data)
      }
    })
  }
  onAppendEnd(data) {
    // data 可能是 {isFlush: true} 之类的对象
    if (data && typeof data === 'object' && data.isFlush) {
      this.logger.info('onAppendEnd', 'flushing decoder')
      this.events.emit(Events.DecodeFlush)
      return
    }

    if (this.checkBuffer() && this.currentIndex !== null) {
      this.logger.info('onAppendEnd', 'load next segment')
      this.loadNext()
      return
    }

    this.dataManageStatus = 'loadend'
    this.logger.info('onAppendEnd', 'load segment stop')
  }
  onAACDemuxed(dataArray) {
    if (this.player.reseting) {
      return
    }
    //no audio data
    if (!dataArray.length) {
      this.audioPlayer.send({})
    }
    dataArray.forEach((data) => {
      if (data.PTS >= this.player.currentTime || data.audioEnd) {
        if (!this.player.receiveAACTime && this.player.seeking) {
          this.player.receiveAACTime = Date.now()
        }
        this.audioPlayer.send(data)
      }
    })
  }
  onVideoDemuxed(data) {
    if (this.player.reseting) {
      return
    }
    this.events.emit(Events.DecodeStartDecode, data)
  }
  checkBuffer() {
    let player = this.player
    let time = player.currentTime
    let buffer = player.buffer()
    let maxTime = buffer[1] || 0
    let bufferLength = maxTime - time
    if (bufferLength >= player.maxBufferLength) {
      return false
    } else {
      return true
    }
  }
  onRead(data) {
    if (this.player.reseting) {
      console.error('onRead reseting')
      return
    }

    if (data && data.arrayBuffer && data.no === this.currentIndex) {
      this.retryTime = 0

      this.logger.warn('onRead', 'get stream data')
      //start demux, get the video and audio
      if (data.no === this.tsNumber) {
        //the last one ts packet
        this.logger.info('onRead', 'the last ts')
        this.events.emit(Events.DemuxLast)
      }
      this.events.emit(Events.DemuxStartDemux, data)
    } else {
      this.logger.error('onRead', 'load ts failred', 'tsno:', this.currentIndex)
    }
  }
}