/**
 * @copyright: Copyright (C) 2019
 * @desc: audioPlayer entry file, inclue audio data decode and play
 * @author: liuliguo 
 * @file: AudioPlayer.js
 */

import BaseClass from '../base/BaseClass.js'
import JMuxer from '../lib/jmuxer.js'
import Events from '../config/EventsConfig'
import AudioContextPlayer from './AudioContextPlayer'
export default class AudioPlayer extends BaseClass {
  need = true
  first = false
  offset = 0
  currentPTS = 0
  ready = false
  end = false
  lastData = null
  nodeParent = null
  useJMuxer = false
  constructor(options = {}) {
    super(options)
    this.player = options.audioNode
    this.createAudioMuxer()
    this.bindEvent()
    this.logger.info('audioDecoder', this.useJMuxer ? 'JMuxer': 'AudioContext')
  }
  bindEvent() {
    this.bindNodeEvent()
    this.events.on(Events.PlayerMaxPTS, (maxAudioPts) => {
      if (this.currentPTS === maxAudioPts) {
        this.end = true
      }
    })
  }
  bindNodeEvent() {
    this.addEventListener('seeked', () => {
      if (this.onSeekedHandler) {
        this.onSeekedHandler()
      }
      this.events.emit('AudioPlayer.seeked')
    })
    this.addEventListener('canplaythrough', () => {
      this.logger.info('canplaythrough')
      if (!this.ready) {
        this.ready = true
        this.status = 'ready'
        this.logger.info('constructor', 'canplaythrough', 'ready')
        this.events.emit(Events.AudioPlayerDataReady)
      }
    })
    this.addEventListener('waiting', () => {
      this.ready = false
      if (!this.end) {
        this.logger.warn('audioPlayer waiting', this.player.currentTime, this.currentPTS)
        this.status = 'waiting'
        this.events.emit(Events.AudioPlayerWait, 'audio')
      } else {
        if(!this.useJMuxer) {
            this.player.destroy()
        }
        this.status = 'end'
        this.events.emit(Events.AudioPlayerEnd, 'audio')
        this.logger.info('audioPlayer end')
      }
    })
  }
  reset() {
    this.lastData = null
    this.first = false
    this.offset = 0
    this.currentPTS = 0
    this.ready = false
    this.end = false
    this.clear()
    this.createAudioMuxer()
    this.bindNodeEvent()
    this.stime = null
  }
  createNode() {
    this.player = document.createElement('audio')
    this.player.classList.add('goldplay__audio--player')
    this.parentNode.appendChild(this.player)
  }
  createAudioMuxer() {
    if(this.useJMuxer) {
        this.audioDecoder = new JMuxer({
            node: this.player,
            mode: 'audio',
            debug: false,
            clearBuffer: true,
            flushingTime: 10,
            onReady: this.onMSEReady.bind(this)
        })
    } else {
        this.audioDecoder = new AudioContextPlayer({
            flushTime: 100,
            onReady: this.onMSEReady.bind(this)
        })
        this.player = this.audioDecoder
    }
  }
  onMSEReady() {
    this.logger.info('onMSEReady', 'AudioPlayerReady')
    this.events.emit(Events.AudioPlayerReady)
  }
  clear() {
    this.audioDecoder.destroy()
    this.audioDecoder = null
  }
  play() {
    if (this.status !== 'playing') {
      this.status = 'playing'
      this.player.play().then(() => {
        this.events.emit(Events.AudioPlayerPlaySuccess)
      }).catch((error) => {
        this.logger.error('play', 'errorInfo:', error)
        this.events.emit(Events.AudioPlayerPlayFail)
      })
    }
  }
  set muted(value) {
    this.player.muted = !!value
  }
  set playbackRate(value) {
    this.player.playbackRate = value
  }
  pause() {
    if (this.status !== 'pause') {
      this.status = 'pause'
      this.player.pause()
    }
  }
  get volume() {
    return this.player.volume
  }
  set volume(value) {
    this.player.volume = value
    if (value === 0) {
      this.muted = true
    } else {
      this.muted = false
    }
  }
  get currentTime() {
    return parseInt(this.player.currentTime * 1000 + this.offset)
  }
  set currentTime(time) {
    this.player.currentTime = (time - this.offset) / 1000
  }
  get paused() {
    return this.player.paused
  }
  send(data) {
    if (!data.PTS) {
      this.need = false;
      this.events.emit(Events.AudioPlayerDataReady);
      return;
    } 
    this.need = true;
    if (!this.audioDecoder) {
      this.logger.error('send', 'audioDecoder is:', this.audioDecoder)
      return
    }
    if (!this.stime) {
      this.stime = Date.now()
    }
    data = this.format(data)
    if (data.audioEnd) {
      this.logger.info('push', 'audioEnd')
      this.feed(this.lastData)
      this.lastData = null
      return
    }

    if (!this.first) {
      this.first = true
      this.offset = data.start
    }

    if (data.PTS > this.currentPTS) {
      if (!this.lastData) {
        this.lastData = data
        return
      } else {
        //get the audio packekt duration
        this.lastData.duration = data.PTS - this.lastData.PTS
      }
      this.feed(this.lastData)
      //record the previous audio duration
      data.duration = this.lastData.duration
      this.lastData = data
    }
  }
  feed(data) {
    this.audioDecoder.feed({
      audio: data.data_byte,
      duration: data.duration
    })
    this.currentPTS = data.PTS
  }
  format(data) {
    if (data && data.data_byte) {
      data.start = data.PTS
    }
    return data
  }

  addEventListener(type, handler) {
    this.player.addEventListener(type, handler)
  }

  isBuffered(time) {
    let bufferList = [this.buffer()]

    let index = bufferList.findIndex(item => {
      return time >= item.start && time < item.end
    })
    return  index !== -1
  }
  
  buffer() {
    if(this.useJMuxer) {
        let buffer = this.player.buffered
        let length = buffer.length
        let bufferInfo = {}
        while (length > 0) {
            bufferInfo.start = buffer.start(length - 1) * 1000 + this.offset
            bufferInfo.end = buffer.end(length - 1) * 1000 + this.offset
            length--
        }
        return bufferInfo
    } else {
      let buffer = this.player.buffer()
      return {
          start: buffer.start + this.offset,
          end: buffer.end + this.offset
      }
    }
  }
  set offset(value) {
    this.offset = value
  }
}
