/**
 * @copyright: Copyright (C) 2019
 * @desc: include some operation, for example play, seek , pause
 * @author: liuliguo 
 * @file: Action.js
 */

import BaseClass from '../base/BaseClass'
import Events from '../config/EventsConfig'
export default class Action extends BaseClass {
  checkHanlder = null
  resetStatus = { processor: false, audioPlayer: false }

  constructor(options) {
    super(options)
    this.player = options.player
    if (!this.player) {
      return
    }
    this.audioPlayer = options.audioPlayer
    this.imagePlayer = options.imagePlayer
    this.dataManage = options.dataManage
    this.bindEvent()
  }
  bindEvent() {
    this.events.on(Events.ProcessorResetEnd, () => {
      this.checkResetReady('processor')
    })
    this.events.on(Events.AudioPlayerReady, () => {
      this.checkResetReady('audioPlayer')
    })
    this.events.on(Events.PlayerResetReady, () => {
      this.onResetReady()
    })
    this.events.on(Events.DataManageSeek, (data, timer) => {
      this.onSeek(data, timer)
    })
    this.events.on(Events.ImagePlayerRenderEnd, (time, gap) => {
      this.onRenderEnd(time, gap)
    })
    this.events.on(Events.ImagePlayerWait, () => {
      this.audioPlayer.pause()
    })
  }
  play(currentTime) {
    this.logger.warn('play', 'play start')
    this.sync(currentTime)
  }
  sync(time) {
    let player = this.player
    let audioPlayer = this.audioPlayer
    let imagePlayer = this.imagePlayer
    let aOffset = audioPlayer.offset
    let vOffset = imagePlayer.offset
    let minTime = Math.min(aOffset, vOffset)
    let maxTime = Math.max(aOffset, vOffset)
    if (!audioPlayer.need) {
      minTime = vOffset
      maxTime = vOffset
    }
    let playbackRate = player.playbackRate
    if (player.seeking) {
      player.seeking = false
    }
    if (player.reseting) {
      return
    }
    if (player.status === 'pause') {
      return
    }
    if (audioPlayer.status === 'waiting' || imagePlayer.status === 'wait') {
      return
    }
    if (player.status === 'end') {
      if (!audioPlayer.paused) {
        audioPlayer.pause()
      }
      return
    }
    this.setCurrentTime(time)
    if (time < minTime) {
      this.sync(minTime)
      return
    }
    //only play audio
    if (audioPlayer.need && time >= aOffset && time <= vOffset) {
      this.events.once(Events.AudioPlayerPlaySuccess, () => {
        imagePlayer.render(vOffset)
      })
      audioPlayer.playbackRate = playbackRate
      audioPlayer.play()
      return
    }
    //only play image
    if (time >= vOffset && (!audioPlayer.need || time <= aOffset)) {
      imagePlayer.render(time)
      return
    }
    //audio and image start play
    if (time > maxTime) {
      this.audioPlayer.playbackRate = playbackRate
      this.audioPlayer.play()
      imagePlayer.render(time)
    }
  }
  setCurrentTime(time) {
    this.player.currentTime = time
    this.events.emit(Events.PlayerTimeUpdate, time)
  }

  pause() {
    this.audioPlayer.pause()
    this.clearDrawHanlder()
  }
  seek(time) {
    let videoBuffered = this.imagePlayer.isBuffered(time)
    let audioBuffered = this.audioPlayer.isBuffered(time)
    this.player.pause()
    //video and audio have the same time period
    if (videoBuffered && audioBuffered) {
      this.logger.warn('seek', `seek in buffer, time: ${time}, buffer: ${this.player.buffer()[0]}, ${this.player.buffer()[1]}`)
      this.audioPlayer.onSeekedHandler = () => {
        this.player.play()
      }
      this.audioPlayer.currentTime = time

    } else {
      this.reset()
    }
  }
  reset(value) {
    this.logger.info('reset', 'reset start')
    this.player.reseting = true
    this.events.emit(Events.PlayerReset, value)
    this.resetStatus = { processor: false, audioPlayer: false }
    this.player.processController.reset()
    this.player.streamController.reset()
    this.player.audioPlayer.reset(value)
    this.player.imagePlayer.reset()
    this.player.currentIndex = null
  }
  checkResetReady(type) {
    let resetStatus = this.resetStatus
    if (type && typeof type === 'string') {
      resetStatus[type] = true
      let keys = Object.keys(resetStatus)
      for (let i = 0; i < keys.length; i++) {
        if (!resetStatus[keys[i]]) {
          return false
        }
      }
      this.logger.warn('checkResetReady', 'reset ready')
      this.events.emit(Events.PlayerResetReady)
    }
  }
  onResetReady() {
    this.player.reseting = false
    this.logger.info('onResetReady', 'reset Ready')
    if (this.player.changing) {
      this.events.emit(Events.DataProcessorReady)
    }
    if (this.player.seeking) {
      this.player.dataManage.seekTime(this.player.currentTime / 1000)
    }
  }
  onSeek(data, timer) {
    let currentTime = this.player.currentTime
    this.logger.info('onseek', currentTime, data, data.no, timer)
    if (data && data.no && Math.abs(currentTime - Math.floor(timer * 1000)) < 2 ) {
      this.player.currentIndex = data.no
      this.logger.info('seektime:', data.no, timer, this.player.currentTime)
      this.player.seekSegmentNo = data.no
      this.player.streamController.startLoad(data.no)
    } else {
      this.logger.warn('seek failue, not found data', currentTime, data, timer)
    }
  }
  clearDrawHanlder() {
    clearTimeout(this.drawFrameHanlder)
    this.drawFrameHanlder = null
  }
  onRenderEnd(time, gap) {
    if (this.player.seekTime) {
      this.logger.info('onRenderEnd', 'seektoRenderTime:', Date.now() - this.player.seekTime)
      this.player.seekTime = null
    }
    let imagePlayer = this.imagePlayer
    let audioPlayer = this.audioPlayer
    let player = this.player
    let playbackRate = player.playbackRate
    let aCurrentTime = audioPlayer.currentTime
    let vCurrentTime = imagePlayer.currentTime
    let aOffset = audioPlayer.offset
    let fragDuration = imagePlayer.fragDuration
    let delay = aCurrentTime - vCurrentTime
    let nextTime = 0
    //no audio
    if (!audioPlayer.need) {
      this.drawNext(time + gap, Math.ceil(gap / playbackRate))
      return
    }
    //only play image
    if (vCurrentTime < aOffset) {
      this.drawNext(vCurrentTime + fragDuration * playbackRate, fragDuration)
      return
    }
    if (delay > 0) {
      if (delay > fragDuration) {
        nextTime = vCurrentTime + Math.ceil(delay / fragDuration + playbackRate) * fragDuration
        fragDuration = nextTime - aCurrentTime
      } else {
        nextTime = vCurrentTime + fragDuration * playbackRate
        fragDuration = fragDuration - delay
      }
    } else {
      nextTime = vCurrentTime + fragDuration * playbackRate
      fragDuration = fragDuration - delay
    }
    this.drawNext(nextTime, fragDuration)
  }
  drawNext(time, spanTime) {
    if (this.drawFrameHanlder) {
      this.clearDrawHanlder()
    }
    this.drawFrameHanlder = setTimeout(() => {
      this.sync(time)
    }, spanTime)
  }
}
