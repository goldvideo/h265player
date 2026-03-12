/**
 * @copyright: Copyright (C) 2021
 * @desc: MP4 packet demux
 * @author: Jarry
 * @file: MP4Demux.js
 */

import { MP4Demux as DemuxerMP4, Events as DemuxerEvents } from 'demuxer'
import { AV_TIME_BASE_Q } from '../config/Config.js'

class MP4Demux {
  maxAudioPTS = 0
  maxVideoPTS = 0

  constructor(decode) {
    if (!decode) {
      console.error('class MP4Demux need pass decode params')
      return
    }
    this.init()
    this.dataArray = []
    this.videoArray = []
    this.audioArray = []
    this.decode = decode
  }

  init() {
    try {
      this.demuxer = new DemuxerMP4({
        enableWorker: false,
        debug: false,
        onlyDemuxElementary: true
      })

      this.demuxer.on(DemuxerEvents.DEMUX_DATA, event => {
        if (event instanceof Array) {
          console.log('MP4Demux DEMUX_DATA array')
          this.dataArray.push(event)
          this.demuxed(this.dataArray)
          this.dataArray = []
        } else {
          this.dataArray.push(event)
        }
      })

      this.demuxer.on(DemuxerEvents.DONE, event => {
        let pes = {}
        this.demuxed(this.dataArray)
        this.dataArray = []
        // one mp4 demux finished
        this.demuxCallback && this.demuxCallback()
      })

      this.demuxer.on(DemuxerEvents.ERROR, event => {
        console.error('MP4Demux error:', event)
      })

    } catch (error) {
      console.error('MP4Demux init error:', error)
    }
  }

  /**
   * 推送数据到demuxer
   */
  push(buffer) {
    if (!this.demuxer) {
      console.error('MP4Demux not initialized')
      return
    }
    try {
      this.demuxer.push(buffer)
    } catch (error) {
      console.error('MP4Demux push error:', error)
    }
  }

  /**
   * 标记最后一个包
   */
  flush() {
    if (this.demuxer && typeof this.demuxer.flush === 'function') {
      this.demuxer.flush()
    }
  }

  /**
   * 处理解复用的数据
   */
  demuxed(dataArray) {
    if (!dataArray || !dataArray.length) {
      return
    }

    dataArray.forEach(data => {
      if (!data) {
        return
      }

      // 处理视频数据
      if (data.video) {
        data.video.forEach(videoData => {
          if (!videoData) return

          // 转换PTS时间戳（从90kHz到毫秒）
          // 90kHz to milliseconds: 除以90
          if (videoData.pts !== undefined && videoData.pts !== null) {
            videoData.pts = Math.round(videoData.pts / 90)
          }
          if (videoData.dts !== undefined && videoData.dts !== null) {
            videoData.dts = Math.round(videoData.dts / 90)
          }
          if (videoData.duration !== undefined && videoData.duration !== null) {
            videoData.duration = Math.round(videoData.duration / 90)
          }

          this.maxVideoPTS = Math.max(this.maxVideoPTS, videoData.pts || 0)
          this.videoArray.push(videoData)
        })

        if (this.videoArray.length > 0) {
          const events = require('../config/EventsConfig').default
          this.demuxCallback && this.demuxCallback()
          // 发送视频数据到decode
          if (this.videoArray.length > 0) {
            console.log('emit video data:', this.videoArray.length)
            // 这里会通过事件系统发送到decode worker
          }
        }
      }

      // 处理音频数据
      if (data.audio) {
        data.audio.forEach(audioData => {
          if (!audioData) return

          // 转换PTS时间戳（从90kHz到毫秒）
          // 90kHz to milliseconds: 除以90
          if (audioData.pts !== undefined && audioData.pts !== null) {
            audioData.pts = Math.round(audioData.pts / 90)
          }
          if (audioData.dts !== undefined && audioData.dts !== null) {
            audioData.dts = Math.round(audioData.dts / 90)
          }
          if (audioData.duration !== undefined && audioData.duration !== null) {
            audioData.duration = Math.round(audioData.duration / 90)
          }

          this.maxAudioPTS = Math.max(this.maxAudioPTS, audioData.pts || 0)
          this.audioArray.push(audioData)
        })

        if (this.audioArray.length > 0) {
          console.log('emit audio data:', this.audioArray.length)
          // 这里会通过事件系统发送到audio player
        }
      }
    })
  }

  /**
   * 获取视频数据
   */
  getVideoData() {
    const data = this.videoArray
    this.videoArray = []
    return data
  }

  /**
   * 获取音频数据
   */
  getAudioData() {
    const data = this.audioArray
    this.audioArray = []
    return data
  }

  /**
   * 设置demux完成回调
   */
  setDemuxCallback(callback) {
    this.demuxCallback = callback
  }

  /**
   * 获取最大视频PTS
   */
  getMaxVideoPTS() {
    return this.maxVideoPTS
  }

  /**
   * 获取最大音频PTS
   */
  getMaxAudioPTS() {
    return this.maxAudioPTS
  }

  /**
   * 销毁demuxer
   */
  destroy() {
    if (this.demuxer) {
      this.demuxer = null
    }
  }
}

export default MP4Demux
