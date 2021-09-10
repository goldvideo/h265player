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
      this.events.emit(Events.PlayerWait, 'imagePlayer')
    })
    this.events.on(Events.ImagePlayerEnd, () => {
      this.logger.info('bindevent', '........imageplayer end')
      this.events.emit(Events.PlayerEnd)
    })
    this.events.on(Events.PlayerWait, () => {
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
    if (data) {
      this.logger.info('onAppendEnd','events.decodeFlush', data)
      this.events.emit(Events.DecodeFlush)
      return
    }
    this.logger.info('onAppendEnd', 'start load next ts condition', this.checkBuffer(), this.currentIndex)
    if (this.checkBuffer() && this.currentIndex !== null) {
      this.logger.info('onAppendEnd', 'load next ts. currentIndex:', this.currentIndex)
      this.loadNext()
      return
    }
    this.dataManageStatus = 'loadend'
    this.logger.info('onAppendEnd', 'load ts stop')
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