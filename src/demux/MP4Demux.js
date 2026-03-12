/* global MP4Box */

/**
 * MP4 demuxer (H.265) using mp4box.js loaded at runtime from libPath.
 */
class MP4Demux {
  constructor(decode, libPath) {
    if (!decode) {
      console.error('MP4Demux requires decode instance')
      return
    }
    this.decode = decode
    this.libPath = libPath || ''
    this.videoTrackId = null
    this.audioTrackId = null
    this.fileStart = 0
    this.hvcc = null
    this.mp4boxfile = null
    this.maxVideoPTS = 0
    this.audioNotified = false
    this.ensureMP4Box()
    this.init()
  }

  ensureMP4Box() {
    if (typeof MP4Box === 'undefined') {
      try {
        // use bundled IIFE to support importScripts
        importScripts(this.libPath + 'mp4box.iife.js')
      } catch (e) {
        console.error('Failed to load mp4box', e, 'libPath:', this.libPath)
      }
    }
  }

  init() {
    if (typeof MP4Box === 'undefined') {
      console.error('MP4Box not available')
      return
    }
    this.mp4boxfile = MP4Box.createFile()

    this.mp4boxfile.onReady = (info) => {
      if (info.videoTracks && info.videoTracks.length) {
        const trak = this.mp4boxfile.moov.traks.find(
          t => t.tkhd.track_id === info.videoTracks[0].id
        )
        const entry = trak.mdia.minf.stbl.stsd.entries[0]
        this.hvcc = entry.hvcC
        this.videoTrackId = info.videoTracks[0].id
        this.mp4boxfile.setExtractionOptions(this.videoTrackId, null, {
          nbSamples: info.videoTracks[0].nb_samples,
          rapAlignment: true
        })
      }

      if (info.audioTracks && info.audioTracks.length) {
        this.audioTrackId = info.audioTracks[0].id
        this.mp4boxfile.setExtractionOptions(this.audioTrackId, null, {
          nbSamples: info.audioTracks[0].nb_samples,
          rapAlignment: true
        })
      }
      this.mp4boxfile.start()
    }

    this.mp4boxfile.onSamples = (id, user, samples) => {
      if (id === this.videoTrackId) {
        this.handleVideoSamples(samples)
      } else if (id === this.audioTrackId) {
        this.handleAudioSamples(samples)
      }
    }

    this.mp4boxfile.onError = (e) => {
      console.error('MP4Box error:', e)
    }
  }

  handleVideoSamples(samples) {
    if (!samples || !samples.length) return
    const pesList = []
    samples.forEach(sample => {
      const pts = Math.round(sample.cts / sample.timescale * 1000)
      const data = this.convertSampleToAnnexB(sample)
      this.maxVideoPTS = Math.max(this.maxVideoPTS, pts)
      pesList.push({
        PTS: pts,
        data_byte: data,
        partEnd: false,
        lastTS: false
      })
    })
    if (pesList.length) {
      this.decode.push(pesList)
    }
  }

  handleAudioSamples() {
    // Current audio pipeline expects ADTS; mp4 provides raw AAC.
    // Notify end to avoid waiting.
    if (!this.audioNotified) {
      self.postMessage({
        type: 'demuxedAAC',
        data: [],
        audioEnd: true
      })
      this.audioNotified = true
    }
  }

  convertSampleToAnnexB(sample) {
    const lengthSize = (sample.description.hvcC.lengthSizeMinusOne || 3) + 1
    const data = sample.data
    let offset = 0
    const units = []

    // prepend VPS/SPS/PPS for key frames
    if (sample.is_sync && this.hvcc && this.hvcc.nalu_arrays) {
      this.hvcc.nalu_arrays.forEach(arr => {
        if ([32, 33, 34].includes(arr.nalu_type)) {
          arr.forEach(n => {
            if (n && n.data) {
              units.push(this.withStartCode(n.data))
            }
          })
        }
      })
    }

    while (offset + lengthSize <= data.byteLength) {
      let len = 0
      for (let i = 0; i < lengthSize; i++) {
        len = (len << 8) | data[offset + i]
      }
      offset += lengthSize
      if (len <= 0 || offset + len > data.byteLength) break
      const nalu = data.subarray(offset, offset + len)
      units.push(this.withStartCode(nalu))
      offset += len
    }
    return this.concatUint8(units)
  }

  withStartCode(nalu) {
    const sc = new Uint8Array([0, 0, 0, 1])
    const out = new Uint8Array(sc.byteLength + nalu.byteLength)
    out.set(sc, 0)
    out.set(nalu, sc.byteLength)
    return out
  }

  concatUint8(list) {
    const total = list.reduce((sum, u) => sum + u.byteLength, 0)
    const out = new Uint8Array(total)
    let offset = 0
    list.forEach(u => {
      out.set(u, offset)
      offset += u.byteLength
    })
    return out
  }

  push(buffer) {
    if (!buffer || !this.mp4boxfile) return

    // Convert various buffer types to ArrayBuffer
    let ab = null
    if (buffer instanceof ArrayBuffer) {
      ab = buffer
    } else if (buffer instanceof Uint8Array || ArrayBuffer.isView(buffer)) {
      // Handle TypedArrays and other ArrayBufferView objects
      // Make sure we have the underlying ArrayBuffer
      try {
        // Try to get the underlying buffer
        ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      } catch (e) {
        // If buffer is detached or inaccessible, log error
        console.error('MP4Demux: Cannot access buffer.buffer, trying to copy data', e)
        // Create a new ArrayBuffer and copy the data
        if (buffer.byteLength > 0) {
          ab = new ArrayBuffer(buffer.byteLength)
          new Uint8Array(ab).set(new Uint8Array(buffer))
        } else {
          return
        }
      }
    } else if (buffer.buffer instanceof ArrayBuffer) {
      // Handle objects with .buffer property
      ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    } else {
      console.error('MP4Demux: Unsupported buffer type', buffer)
      return
    }

    if (!ab || ab.byteLength === 0) return

    ab.fileStart = this.fileStart
    this.fileStart += ab.byteLength
    try {
      this.mp4boxfile.appendBuffer(ab)
      this.mp4boxfile.flush()
    } catch (error) {
      console.error('MP4Demux: Error appending buffer:', error)
    }
  }

  flush() {
    if (this.mp4boxfile) {
      this.mp4boxfile.flush()
    }
  }
}

export default MP4Demux
