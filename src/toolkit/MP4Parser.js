/**
 * @copyright: Copyright (C) 2021
 * @file MP4Parser.js
 * @desc MP4 file parser - parse metadata, extract moov box, build segment index
 * @author Jarry
 */

import Logger from './Logger'

const logger = Logger.get('MP4Parser.js', { level: 2 })

/**
 * MP4 Box 类型常量
 */
const BOX_TYPES = {
  FTYP: 'ftyp',
  MDAT: 'mdat',
  MOOV: 'moov',
  MVHD: 'mvhd',
  TRAK: 'trak',
  TKHD: 'tkhd',
  EDTS: 'edts',
  ELST: 'elst',
  MDIA: 'mdia',
  MDHD: 'mdhd',
  HDLR: 'hdlr',
  MINF: 'minf',
  SMHD: 'smhd',
  VMHD: 'vmhd',
  STBL: 'stbl',
  STSD: 'stsd',
  STTS: 'stts',
  STSC: 'stsc',
  STSZ: 'stsz',
  STCO: 'stco',
  CO64: 'co64',
  CTTS: 'ctts',
  STSS: 'stss'
}

class MP4Parser {
  constructor(options = {}) {
    this.data = null
    this.segmentDuration = options.segmentDuration || 2  // 支持自定义分片时长
    this.metadata = {
      duration: 0,
      timescale: 1000,
      videoTrack: null,
      audioTrack: null,
      width: 0,
      height: 0,
      fps: 30,
      bitrate: 0
    }
    this.moovBox = null
    this.segments = []
  }

  /**
   * 解析MP4文件
   */
  parse(buffer) {
    if (!buffer || buffer.byteLength < 8) {
      logger.error('parse', 'Invalid buffer size')
      return false
    }

    this.data = new DataView(buffer)

    try {
      this.readBoxes(0, buffer.byteLength)
      if (!this.moovBox) {
        logger.error('parse', 'No moov box found')
        return false
      }

      this.extractMetadata()
      this.buildSegmentIndex()
      return true
    } catch (error) {
      logger.error('parse', 'Parse error:', error)
      return false
    }
  }

  /**
   * 读取box树结构
   */
  readBoxes(offset, maxSize) {
    const maxIterations = 1000  // 防止DoS
    let iterations = 0

    while (offset < maxSize && iterations < maxIterations) {
      if (offset + 8 > maxSize) break

      const size = this.readUint32(offset)

      // 检查size有效性
      if (size === 0) {
        logger.warn('readBoxes', 'zero-size box detected')
        break
      }
      if (size < 8) {
        logger.warn('readBoxes', 'invalid box size', size)
        break
      }
      if (size > maxSize - offset) {
        logger.warn('readBoxes', 'box size exceeds remaining data')
        break
      }

      const type = this.readBoxType(offset + 4)

      if (type === BOX_TYPES.MOOV) {
        this.moovBox = { offset, size, type }
      }

      offset += size
      iterations++
    }

    if (iterations >= maxIterations) {
      logger.error('readBoxes', 'max iterations exceeded, possible malformed MP4')
    }
  }

  /**
   * 读取32位大端整数
   */
  readUint32(offset) {
    return this.data.getUint32(offset, false)
  }

  /**
   * 读取16位大端整数
   */
  readUint16(offset) {
    return this.data.getUint16(offset, false)
  }

  /**
   * 读取8位整数
   */
  readUint8(offset) {
    return this.data.getUint8(offset)
  }

  /**
   * 读取Box类型（4字节ASCII）
   */
  readBoxType(offset) {
    const chars = []
    for (let i = 0; i < 4; i++) {
      chars.push(String.fromCharCode(this.readUint8(offset + i)))
    }
    return chars.join('')
  }

  /**
   * 读取定点数（16.16）
   */
  readFixed32(offset) {
    if (offset + 4 > this.data.byteLength) {
      logger.warn('readFixed32', 'offset out of range')
      return 0
    }
    const value = this.readUint32(offset)
    const intPart = value >>> 16
    const fracPart = (value & 0xFFFF) / 65536
    return intPart + fracPart
  }

  /**
   * 从Buffer提取文本
   */
  readString(offset, length) {
    const chars = []
    for (let i = 0; i < length; i++) {
      const char = this.readUint8(offset + i)
      if (char === 0) break
      chars.push(String.fromCharCode(char))
    }
    return chars.join('')
  }

  /**
   * 提取元数据
   */
  extractMetadata() {
    if (!this.moovBox) return

    const moovOffset = this.moovBox.offset
    const moovEnd = moovOffset + this.moovBox.size

    // 读取mvhd获取时长和时间刻度
    let offset = moovOffset + 8
    while (offset < moovEnd) {
      const size = this.readUint32(offset)
      const type = this.readBoxType(offset + 4)

      if (type === BOX_TYPES.MVHD) {
        this.parseMVHD(offset)
      } else if (type === BOX_TYPES.TRAK) {
        this.parseTRAK(offset, offset + size)
      }

      offset += size
    }
  }

  /**
   * 解析Movie Header Box (mvhd)
   */
  parseMVHD(offset) {
    const version = this.readUint8(offset + 8)
    let timeOffset = offset + 12

    if (version === 0) {
      // version 0: creation_time(4) + modification_time(4) + timescale(4) + duration(4)
      this.metadata.timescale = this.readUint32(timeOffset + 8)
      this.metadata.duration = this.readUint32(timeOffset + 12) / this.metadata.timescale
    } else {
      // version 1: creation_time(8) + modification_time(8) + timescale(4) + duration(8)
      this.metadata.timescale = this.readUint32(timeOffset + 16)
      this.metadata.duration = Number(this.readUint64(timeOffset + 20)) / this.metadata.timescale
    }

    logger.info('parseMVHD', 'duration:', this.metadata.duration, 'timescale:', this.metadata.timescale)
  }

  /**
   * 读取64位整数
   */
  readUint64(offset) {
    const high = this.readUint32(offset)
    const low = this.readUint32(offset + 4)

    // 如果高位为0，直接返回低位（大多数情况，适用于4小时内的视频）
    if (high === 0) {
      return low
    }

    // 对于更大的值，使用BigInt处理精度
    try {
      const bigValue = (BigInt(high) << BigInt(32)) | BigInt(low)
      return Number(bigValue)
    } catch (e) {
      // BigInt不支持的环境，返回近似值
      return (high * 0x100000000) + low
    }
  }

  /**
   * 解析Track Box (trak)
   */
  parseTRAK(offset, trakEnd) {
    let trakOffset = offset + 8
    let trackInfo = {
      type: 'unknown',
      duration: 0,
      timescale: 1000,
      codec: '',
      sampleCount: 0
    }

    while (trakOffset < trakEnd) {
      const size = this.readUint32(trakOffset)
      const type = this.readBoxType(trakOffset + 4)

      if (type === BOX_TYPES.TKHD) {
        this.parseTKHD(trakOffset, trackInfo)
      } else if (type === BOX_TYPES.MDIA) {
        this.parseMDIA(trakOffset, trakOffset + size, trackInfo)
      }

      trakOffset += size
    }

    // 如果是视频轨道，保存信息
    if (trackInfo.type === 'video') {
      this.metadata.videoTrack = trackInfo
    } else if (trackInfo.type === 'audio') {
      this.metadata.audioTrack = trackInfo
    }
  }

  /**
   * 解析Track Header Box (tkhd)
   */
  parseTKHD(offset, trackInfo) {
    const version = this.readUint8(offset + 8)
    let timeOffset = offset + 12

    if (version === 0) {
      // version 0: creation_time(4) + modification_time(4) + track_id(4) + reserved(4) + duration(4)
      trackInfo.duration = this.readUint32(timeOffset + 16)
    } else {
      // version 1: creation_time(8) + modification_time(8) + track_id(4) + reserved(4) + duration(8)
      trackInfo.duration = Number(this.readUint64(timeOffset + 24))
    }

    // 读取宽高（定点数）
    const width = this.readFixed32(offset + 84)
    const height = this.readFixed32(offset + 88)

    if (width > 0 && height > 0) {
      this.metadata.width = width
      this.metadata.height = height
    }
  }

  /**
   * 解析Media Box (mdia)
   */
  parseMDIA(offset, mdiaEnd, trackInfo) {
    let mdiaOffset = offset + 8

    while (mdiaOffset < mdiaEnd) {
      const size = this.readUint32(mdiaOffset)
      const type = this.readBoxType(mdiaOffset + 4)

      if (type === BOX_TYPES.MDHD) {
        this.parseMDHD(mdiaOffset, trackInfo)
      } else if (type === BOX_TYPES.HDLR) {
        this.parseHDLR(mdiaOffset, trackInfo)
      } else if (type === BOX_TYPES.MINF) {
        this.parseMINF(mdiaOffset, mdiaOffset + size, trackInfo)
      }

      mdiaOffset += size
    }
  }

  /**
   * 解析Media Header Box (mdhd)
   */
  parseMDHD(offset, trackInfo) {
    const version = this.readUint8(offset + 8)
    let timeOffset = offset + 12

    if (version === 0) {
      // version 0: creation_time(4) + modification_time(4) + timescale(4)
      trackInfo.timescale = this.readUint32(timeOffset + 8)
    } else {
      // version 1: creation_time(8) + modification_time(8) + timescale(4)
      trackInfo.timescale = this.readUint32(timeOffset + 16)
    }
  }

  /**
   * 解析Handler Reference Box (hdlr)
   */
  parseHDLR(offset, trackInfo) {
    const handlerType = this.readBoxType(offset + 16)
    if (handlerType === 'vide') {
      trackInfo.type = 'video'
    } else if (handlerType === 'soun') {
      trackInfo.type = 'audio'
    }
  }

  /**
   * 解析Media Information Box (minf)
   */
  parseMINF(offset, minfEnd, trackInfo) {
    let minfOffset = offset + 8

    while (minfOffset < minfEnd) {
      const size = this.readUint32(minfOffset)
      const type = this.readBoxType(minfOffset + 4)

      if (type === BOX_TYPES.STBL) {
        this.parseSTBL(minfOffset, minfOffset + size, trackInfo)
      }

      minfOffset += size
    }
  }

  /**
   * 解析Sample Table Box (stbl)
   */
  parseSTBL(offset, stblEnd, trackInfo) {
    let stblOffset = offset + 8

    while (stblOffset < stblEnd) {
      const size = this.readUint32(stblOffset)
      const type = this.readBoxType(stblOffset + 4)

      if (type === BOX_TYPES.STSD) {
        this.parseSTSD(stblOffset, trackInfo)
      } else if (type === BOX_TYPES.STSZ) {
        this.parseSTSZ(stblOffset, trackInfo)
      }

      stblOffset += size
    }
  }

  /**
   * 解析Sample Description Box (stsd)
   */
  parseSTSD(offset, trackInfo) {
    const entryCount = this.readUint32(offset + 12)
    if (entryCount > 0) {
      const codecType = this.readBoxType(offset + 20)
      trackInfo.codec = codecType
    }
  }

  /**
   * 解析Sample Size Box (stsz)
   */
  parseSTSZ(offset, trackInfo) {
    const count = this.readUint32(offset + 12)
    trackInfo.sampleCount = count
  }

  /**
   * 构建分片索引
   * 基于固定时间间隔（可配置）或关键帧
   */
  buildSegmentIndex() {
    if (this.metadata.duration <= 0) {
      logger.error('buildSegmentIndex', 'Invalid duration')
      return
    }

    const totalSegments = Math.ceil(this.metadata.duration / this.segmentDuration)

    this.segments = []
    for (let i = 0; i < totalSegments; i++) {
      const startTime = i * this.segmentDuration
      const endTime = Math.min((i + 1) * this.segmentDuration, this.metadata.duration)

      this.segments.push({
        no: i + 1,
        name: `segment_${i}`,
        start: startTime,
        end: endTime,
        duration: endTime - startTime,
        time: startTime
      })
    }

    logger.info('buildSegmentIndex', 'Total segments:', this.segments.length, 'Duration:', this.segmentDuration)
  }

  /**
   * 根据时间获取对应的分片
   */
  getSegmentByTime(time) {
    if (!this.segments || !this.segments.length) {
      return null
    }

    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i]
      if (time >= segment.start && time < segment.end) {
        return segment
      }
    }

    return this.segments[0]
  }

  /**
   * 获取所有分片
   */
  getSegments() {
    return this.segments
  }

  /**
   * 获取元数据
   */
  getMetadata() {
    return this.metadata
  }

  /**
   * 获取视频总时长（秒）
   */
  getDuration() {
    return this.metadata.duration
  }

  /**
   * 获取视频分辨率
   */
  getResolution() {
    return {
      width: this.metadata.width,
      height: this.metadata.height
    }
  }
}

export default MP4Parser
