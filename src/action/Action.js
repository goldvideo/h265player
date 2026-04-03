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
  finishSeekIfNeeded() {
    if (this.player.seeking) {
      this.player.seeking = false
    }
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
    if (player.reseting) {
      return
    }
    if (player.status === 'pause') {
      return
    }
    if (imagePlayer.status === 'wait') {
      return
    }
    if (audioPlayer.status === 'waiting') {
      // If near the end of the video, don't block — let video finish
      let durationMs = player.duration * 1000
      if (durationMs > 0 && time >= durationMs - 500) {
        this.events.emit(Events.PlayerEnd)
        return
      }
      if (player.seeking && imagePlayer.isBuffered(time)) {
        const renderTime = imagePlayer.getRenderTime(time)
        this.setCurrentTime(renderTime)
        this.finishSeekIfNeeded()
        imagePlayer.render(renderTime)
      }
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
        this.finishSeekIfNeeded()
        imagePlayer.render(vOffset)
      })
      audioPlayer.playbackRate = playbackRate
      audioPlayer.play()
      return
    }
    //only play image
    if (time >= vOffset && (!audioPlayer.need || time <= aOffset)) {
      this.finishSeekIfNeeded()
      imagePlayer.render(time)
      return
    }
    //audio and image start play
    if (time > maxTime) {
      this.finishSeekIfNeeded()
      this.audioPlayer.playbackRate = playbackRate
      this.audioPlayer.play()
      imagePlayer.render(time)
    }
  }
  setCurrentTime(time) {
    // Clamp time to not exceed duration
    let duration = this.player.duration
    if (duration && time > duration * 1000) {
      time = duration * 1000
    }
    this.player.currentTime = time
    this.events.emit(Events.PlayerTimeUpdate, time)
  }
  resumeBufferedSeek(time, syncAudio = true) {
    this.player.currentTime = time
    if (syncAudio) {
      try {
        this.audioPlayer.currentTime = time
      } catch (e) {
        this.logger.warn('seek', 'audio seek failed, continue with video frame seek')
      }
    }
    this.finishSeekIfNeeded()
    // Render the first frame immediately so seek does not pause for an extra
    // turn of the event loop waiting on audio seek/play callbacks.
    this.imagePlayer.render(time)
    if (this.audioPlayer.need) {
      this.audioPlayer.playbackRate = this.player.playbackRate
      this.audioPlayer.play()
    }
    this.player.status = 'playing'
    this.events.emit(Events.PlayerPlay, this.player)
  }

  pause() {
    this.audioPlayer.pause()
    this.clearDrawHanlder()
  }
  seek(time) {
    let videoBuffered = this.imagePlayer.isBuffered(time)
    let audioBuffered = this.audioPlayer.isBuffered(time)
    let renderTime = videoBuffered ? this.imagePlayer.getRenderTime(time) : time
    this.player.pause()
    //video and audio have the same time period
    if (videoBuffered && audioBuffered) {
      this.logger.warn('seek', `seek in buffer, time: ${time}, buffer: ${this.player.buffer()[0]}, ${this.player.buffer()[1]}`)
      this.resumeBufferedSeek(renderTime, true)

    } else if (videoBuffered && !this.audioPlayer.need) {
      // MP4 with no audio sync: seek directly within video buffer
      this.resumeBufferedSeek(renderTime, false)

    } else if (videoBuffered && this.audioPlayer.need) {
      // HLS: if video is already buffered, resume from the nearest decodable
      // frame instead of resetting the whole pipeline just because audio lags.
      this.resumeBufferedSeek(renderTime, true)

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
    if (data && data.no && Math.abs(currentTime - Math.floor(timer * 1000)) < 10 ) {
      this.player.currentIndex = data.no
      this.logger.info('seektime:', data.no, timer, this.player.currentTime)
      this.player.seekSegmentNo = data.no
      this.player.streamController.startLoad(data.no)
    } else {
      this.logger.warn('seek failue, not found data', currentTime, data, timer)
      // Recover from failed seek — clear seeking state to avoid permanent spinner
      this.player.seeking = false
      this.player.pause()
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

    // Periodically trim old buffers to free memory (every ~2 seconds of playback)
    this.trimBuffers(vCurrentTime)

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
    // If audio time is wildly out of sync (e.g. after backward seek when audio
    // buffers were depleted), ignore A/V sync and render at normal speed.
    // This prevents the "extremely slow playback" bug.
    let absDelay = Math.abs(delay)
    if (absDelay > 2000) {
      this.drawNext(time + gap, Math.ceil(gap / playbackRate))
      return
    }
    // Cap to prevent extremely slow playback after seek near end
    let maxWait = fragDuration * 2
    if (delay > 0) {
      if (delay > fragDuration) {
        // Audio far ahead — skip video frames to catch up
        nextTime = vCurrentTime + Math.ceil(delay / fragDuration + playbackRate) * fragDuration
        fragDuration = Math.max(nextTime - aCurrentTime, 1)
        fragDuration = Math.min(fragDuration, maxWait)
      } else {
        // Audio slightly ahead — speed up video a bit
        nextTime = vCurrentTime + fragDuration * playbackRate
        fragDuration = Math.max(fragDuration - delay, 1)
      }
    } else {
      // Video ahead of audio — slow down slightly but cap the wait
      nextTime = vCurrentTime + fragDuration * playbackRate
      fragDuration = Math.min(fragDuration - delay, maxWait)
    }
    this.drawNext(nextTime, fragDuration)
  }
  /**
   * Trim old video and audio buffers that are well behind the current playback
   * position to keep memory usage bounded for long videos.
   * Called periodically from onRenderEnd.
   */
  trimBuffers(currentTime) {
    // Only trim every ~2 seconds to avoid overhead
    if (this._lastTrimTime && currentTime - this._lastTrimTime < 2000) {
      return
    }
    this._lastTrimTime = currentTime

    // Keep a safety margin before current position (e.g. 5 seconds)
    let trimBefore = currentTime - 5000
    if (trimBefore <= 0) {
      return
    }
    // Trim audio buffers
    if (this.audioPlayer && typeof this.audioPlayer.trimBuffer === 'function') {
      this.audioPlayer.trimBuffer(trimBefore)
    }
    // Video trimming is handled by ImageData.checkBuffer via maxBufferLength
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
