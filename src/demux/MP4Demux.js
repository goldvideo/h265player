/* global MP4Box */
import MP4SampleExtractor from './MP4SampleExtractor'

/**
 * MP4 demuxer (H.265) using mp4box.js loaded at runtime from libPath.
 * Falls back to manual sample extraction if mp4box.js fails.
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
    this.initialized = false
    this.usingSampleExtractor = false
    this.sampleExtractor = null
    this.sampleIndex = 0
    this.fullBuffer = null
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
    this.mp4boxfile = MP4Box.createFile({ chunked: false })

    this.mp4boxfile.onReady = (info) => {
      this.initialized = true
      try {
        if (info.videoTracks && info.videoTracks.length) {
          const trak = this.mp4boxfile.moov.traks.find(
            t => t.tkhd.track_id === info.videoTracks[0].id
          )
          if (trak && trak.mdia && trak.mdia.minf && trak.mdia.minf.stbl) {
            const stsd = trak.mdia.minf.stbl.stsd
            if (stsd && stsd.entries && stsd.entries.length > 0) {
              this.hvcc = stsd.entries[0].hvcC
            }
          }
          this.videoTrackId = info.videoTracks[0].id

          try {
            this.mp4boxfile.setExtractionOptions(this.videoTrackId, null, {
              nbSamples: info.videoTracks[0].nb_samples,
              rapAlignment: true
            })
          } catch (e) { /* ignore */ }
        }

        if (info.audioTracks && info.audioTracks.length) {
          this.audioTrackId = info.audioTracks[0].id
          try {
            this.mp4boxfile.setExtractionOptions(this.audioTrackId, null, {
              nbSamples: info.audioTracks[0].nb_samples,
              rapAlignment: true
            })
          } catch (e) { /* ignore */ }
        }

        try {
          this.mp4boxfile.start()
        } catch (e) { /* ignore */ }
      } catch (e) {
        console.error('[MP4Demux] onReady error:', e)
      }
    }

    this.mp4boxfile.onSamples = (id, user, samples) => {
      if (id === this.videoTrackId) {
        this.handleVideoSamples(samples)
      } else if (id === this.audioTrackId) {
        this.handleAudioSamples(samples)
      }
    }

    this.mp4boxfile.onError = (e) => {
      console.error('[MP4Demux] MP4Box error:', e)
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
    // Fix: Check if hvcC exists before accessing properties
    const hvcC = sample.description.hvcC
    const lengthSize = (hvcC && hvcC.lengthSizeMinusOne !== undefined)
      ? (hvcC.lengthSizeMinusOne + 1)
      : 4

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
    } else if (buffer instanceof Uint8Array) {
      ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    } else if (ArrayBuffer.isView(buffer)) {
      ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    } else if (buffer && buffer.buffer instanceof ArrayBuffer) {
      ab = buffer.buffer
    } else {
      console.error('MP4Demux: Unsupported buffer type')
      return
    }

    if (!ab || ab.byteLength === 0) return

    // Store complete buffer for fallback extraction
    if (!this.fullBuffer) {
      this.fullBuffer = ab
    }

    ab.fileStart = this.fileStart
    this.fileStart += ab.byteLength

    try {
      let appendSuccess = false
      try {
        this.mp4boxfile.appendBuffer(ab)
        appendSuccess = true
      } catch (e1) {
        console.warn('MP4Demux: appendBuffer failed:', e1.message, '- using fallback')
        this.useFallbackSampleExtraction()
      }

      if (!this.usingSampleExtractor) {
        try {
          this.mp4boxfile.flush()
        } catch (e2) {
          // ignore flush errors
        }
      }
    } catch (error) {
      console.error('MP4Demux: Unrecoverable error:', error?.message)
    }
  }

  /**
   * Use fallback sample extraction when mp4box.js fails
   */
  useFallbackSampleExtraction() {
    if (this.usingSampleExtractor) {
      console.log('MP4Demux: Already using sample extractor')
      return
    }

    try {
      console.log('[MP4Demux] Initializing fallback sample extraction')
      this.usingSampleExtractor = true

      // Find moov box in the buffer
      if (!this.mp4boxfile.moov) {
        console.error('[MP4Demux] moov box not found, cannot extract samples')
        return
      }

      // Find moov offset in buffer
      let moovOffset = this.findMoovOffset()
      if (moovOffset < 0) {
        console.error('[MP4Demux] Could not find moov box offset in buffer')
        return
      }

      // Get hvcc from moov if not already set
      // This is critical for proper sample decoding
      if (!this.hvcc && this.mp4boxfile.moov && this.mp4boxfile.moov.traks) {
        console.log('[MP4Demux] Looking for HVCC from moov box...')
        for (const trak of this.mp4boxfile.moov.traks) {
          if (trak.mdia && trak.mdia.hdlr && trak.mdia.hdlr.handlerType === 'vide') {
            console.log('[MP4Demux] Found video track, looking for HVCC...')
            if (trak.mdia.minf && trak.mdia.minf.stbl && trak.mdia.minf.stbl.stsd) {
              const entry = trak.mdia.minf.stbl.stsd.entries?.[0]
              if (entry && entry.hvcC) {
                this.hvcc = entry.hvcC
                console.log('[MP4Demux] Found HVCC:', {
                  lengthSizeMinusOne: this.hvcc.lengthSizeMinusOne,
                  nalu_arrays_count: this.hvcc.nalu_arrays?.length || 0
                })
              } else {
                console.warn('[MP4Demux] HVCC not found in video track entry')
              }
            } else {
              console.warn('[MP4Demux] STSD not found in video track')
            }
            break
          }
        }
      }

      // If HVCC still not found, try to extract hvcC from buffer directly
      if (!this.hvcc && moovOffset >= 0) {
        console.log('[MP4Demux] HVCC not found in moov, attempting direct buffer extraction...')
        this.extractHvccFromBuffer(moovOffset)
      }

      if (!this.hvcc) {
        console.warn('[MP4Demux] HVCC not found, will use default lengthSize=4')
        // Create minimal HVCC for fallback
        this.hvcc = {
          lengthSizeMinusOne: 3,
          nalu_arrays: []
        }
      }

      const moovSize = this.mp4boxfile.moov.size || 0

      // Create sample extractor
      this.sampleExtractor = new MP4SampleExtractor(
        this.fullBuffer,
        moovOffset,
        moovSize,
        this.hvcc
      )

      // Find video track offset in moov
      let videoTrackOffset = this.findVideoTrackOffset(moovOffset)
      if (videoTrackOffset < 0) {
        console.error('[MP4Demux] Video track not found')
        return
      }

      // Extract samples
      const samples = this.sampleExtractor.extractSamples(videoTrackOffset)
      console.log('[MP4Demux] Extracted', samples.length, 'samples using fallback')

      if (samples.length > 0) {
        // Process all samples at once
        this.processExtractedSamples(samples)
      }

      // Notify that we're done
      this.initialized = true
      if (!this.audioNotified) {
        self.postMessage({
          type: 'demuxedAAC',
          data: [],
          audioEnd: true
        })
        this.audioNotified = true
      }
    } catch (error) {
      console.error('[MP4Demux] Error in fallback sample extraction:', error)
    }
  }

  /**
   * Extract hvcC box directly from buffer
   */
  extractHvccFromBuffer(moovOffset) {
    try {
      const buffer = this.fullBuffer
      const moovSize = ((new Uint8Array(buffer, moovOffset, 4)[0] << 24) |
                        (new Uint8Array(buffer, moovOffset + 1, 1)[0] << 16) |
                        (new Uint8Array(buffer, moovOffset + 2, 1)[0] << 8) |
                        new Uint8Array(buffer, moovOffset + 3, 1)[0])

      const moovEnd = moovOffset + moovSize
      let offset = moovOffset + 8

      while (offset + 8 < moovEnd) {
        const sizeBytes = new Uint8Array(buffer, offset, 4)
        const size = (sizeBytes[0] << 24) | (sizeBytes[1] << 16) | (sizeBytes[2] << 8) | sizeBytes[3]

        const typeBytes = new Uint8Array(buffer, offset + 4, 4)
        const type = String.fromCharCode(typeBytes[0], typeBytes[1], typeBytes[2], typeBytes[3])

        if (type === 'trak') {
          const hvcc = this.findHvcCInTrak(offset, offset + size, buffer)
          if (hvcc) {
            this.hvcc = hvcc
            console.log('[MP4Demux] Found hvcC from buffer:', {
              lengthSizeMinusOne: hvcc.lengthSizeMinusOne
            })
            return
          }
        }

        if (size === 0 || size < 8) break
        offset += size
      }

      console.warn('[MP4Demux] Could not find hvcC in buffer')
    } catch (error) {
      console.warn('[MP4Demux] Error extracting hvcC from buffer:', error)
    }
  }

  /**
   * Find hvcC box in a trak box
   */
  findHvcCInTrak(trakStart, trakEnd, buffer) {
    try {
      let offset = trakStart + 8

      while (offset + 8 < trakEnd) {
        const sizeBytes = new Uint8Array(buffer, offset, 4)
        const size = (sizeBytes[0] << 24) | (sizeBytes[1] << 16) | (sizeBytes[2] << 8) | sizeBytes[3]

        const typeBytes = new Uint8Array(buffer, offset + 4, 4)
        const type = String.fromCharCode(typeBytes[0], typeBytes[1], typeBytes[2], typeBytes[3])

        if (type === 'mdia') {
          const hvcc = this.findHvcCInMdia(offset, offset + size, buffer)
          if (hvcc) return hvcc
        }

        if (size === 0 || size < 8) break
        offset += size
      }
    } catch (error) {
      console.warn('[MP4Demux] Error finding hvcC in trak:', error)
    }
    return null
  }

  /**
   * Find hvcC box in a mdia box
   */
  findHvcCInMdia(mdiaStart, mdiaEnd, buffer) {
    try {
      let offset = mdiaStart + 8

      while (offset + 8 < mdiaEnd) {
        const sizeBytes = new Uint8Array(buffer, offset, 4)
        const size = (sizeBytes[0] << 24) | (sizeBytes[1] << 16) | (sizeBytes[2] << 8) | sizeBytes[3]

        const typeBytes = new Uint8Array(buffer, offset + 4, 4)
        const type = String.fromCharCode(typeBytes[0], typeBytes[1], typeBytes[2], typeBytes[3])

        if (type === 'minf') {
          const hvcc = this.findHvcCInMinf(offset, offset + size, buffer)
          if (hvcc) return hvcc
        }

        if (size === 0 || size < 8) break
        offset += size
      }
    } catch (error) {
      console.warn('[MP4Demux] Error finding hvcC in mdia:', error)
    }
    return null
  }

  /**
   * Find hvcC box in a minf box
   */
  findHvcCInMinf(minfStart, minfEnd, buffer) {
    try {
      let offset = minfStart + 8

      while (offset + 8 < minfEnd) {
        const sizeBytes = new Uint8Array(buffer, offset, 4)
        const size = (sizeBytes[0] << 24) | (sizeBytes[1] << 16) | (sizeBytes[2] << 8) | sizeBytes[3]

        const typeBytes = new Uint8Array(buffer, offset + 4, 4)
        const type = String.fromCharCode(typeBytes[0], typeBytes[1], typeBytes[2], typeBytes[3])

        if (type === 'stbl') {
          const hvcc = this.findHvcCInStbl(offset, offset + size, buffer)
          if (hvcc) return hvcc
        }

        if (size === 0 || size < 8) break
        offset += size
      }
    } catch (error) {
      console.warn('[MP4Demux] Error finding hvcC in minf:', error)
    }
    return null
  }

  /**
   * Find hvcC box in a stbl box
   */
  findHvcCInStbl(stblStart, stblEnd, buffer) {
    try {
      let offset = stblStart + 8

      while (offset + 8 < stblEnd) {
        const sizeBytes = new Uint8Array(buffer, offset, 4)
        const size = (sizeBytes[0] << 24) | (sizeBytes[1] << 16) | (sizeBytes[2] << 8) | sizeBytes[3]

        const typeBytes = new Uint8Array(buffer, offset + 4, 4)
        const type = String.fromCharCode(typeBytes[0], typeBytes[1], typeBytes[2], typeBytes[3])

        if (type === 'stsd') {
          return this.parseHvcCFromStsd(offset, offset + size, buffer)
        }

        if (size === 0 || size < 8) break
        offset += size
      }
    } catch (error) {
      console.warn('[MP4Demux] Error finding hvcC in stbl:', error)
    }
    return null
  }

  /**
   * Parse hvcC configuration from stsd (Sample Description) box
   */
  parseHvcCFromStsd(stsdStart, stsdEnd, buffer) {
    try {
      const dv = new DataView(buffer)
      // stsd: box header (8) + version/flags (4) + entry_count (4)
      const entryCount = dv.getUint32(stsdStart + 12)
      if (entryCount === 0) return null

      // First sample entry starts at stsdStart + 16
      const entryOffset = stsdStart + 16
      const entrySize = dv.getUint32(entryOffset)
      const entryEnd = entryOffset + entrySize

      // hev1/hvc1 VisualSampleEntry: box header (8) + reserved (6) + data_ref_index (2) +
      // pre_defined (2) + reserved (2) + pre_defined (12) + width (2) + height (2) +
      // horizresolution (4) + vertresolution (4) + reserved (4) + frame_count (2) +
      // compressorname (32) + depth (2) + pre_defined (2) = 78 bytes after header
      // So child boxes start at entryOffset + 8 + 78 = entryOffset + 86
      let offset = entryOffset + 86

      while (offset + 8 < entryEnd) {
        const size = dv.getUint32(offset)
        const t0 = dv.getUint8(offset + 4)
        const t1 = dv.getUint8(offset + 5)
        const t2 = dv.getUint8(offset + 6)
        const t3 = dv.getUint8(offset + 7)
        const type = String.fromCharCode(t0, t1, t2, t3)

        if (type === 'hvcC') {
          return this.parseHvcCBox(buffer, offset + 8, offset + size)
        }

        if (size === 0 || size < 8) break
        offset += size
      }
    } catch (error) {
      console.warn('[MP4Demux] Error parsing hvcC from stsd:', error)
    }
    return null
  }

  /**
   * Parse the body of an hvcC box into { lengthSizeMinusOne, nalu_arrays }
   * ISO/IEC 14496-15 §8.3.3.1
   */
  parseHvcCBox(buffer, start, end) {
    try {
      const dv = new DataView(buffer)
      let p = start

      // configurationVersion (1)
      p += 1
      // general_profile_space (2) | general_tier_flag (1) | general_profile_idc (5)
      p += 1
      // general_profile_compatibility_flags (4)
      p += 4
      // general_constraint_indicator_flags (6)
      p += 6
      // general_level_idc (1)
      p += 1
      // min_spatial_segmentation_idc (4 bits reserved + 12 bits)
      p += 2
      // parallelismType (6 bits reserved + 2 bits)
      p += 1
      // chromaFormat (6 bits reserved + 2 bits)
      p += 1
      // bitDepthLumaMinus8 (5 bits reserved + 3 bits)
      p += 1
      // bitDepthChromaMinus8 (5 bits reserved + 3 bits)
      p += 1
      // avgFrameRate (16)
      p += 2
      // constantFrameRate (2) | numTemporalLayers (3) | temporalIdNested (1) | lengthSizeMinusOne (2)
      const misc = dv.getUint8(p)
      const lengthSizeMinusOne = misc & 0x03
      p += 1

      // numOfArrays (8)
      const numOfArrays = dv.getUint8(p)
      p += 1

      console.log('[MP4Demux] hvcC: lengthSizeMinusOne=' + lengthSizeMinusOne +
        ', numOfArrays=' + numOfArrays)

      const nalu_arrays = []

      for (let i = 0; i < numOfArrays && p + 3 <= end; i++) {
        // array_completeness (1) | reserved (1) | NAL_unit_type (6)
        const naluType = dv.getUint8(p) & 0x3F
        p += 1
        const numNalus = dv.getUint16(p)
        p += 2

        // Build an array-like object that matches mp4box.js structure:
        // arr.nalu_type = type, arr[0].data, arr[1].data, …
        const arr = []
        arr.nalu_type = naluType

        for (let j = 0; j < numNalus && p + 2 <= end; j++) {
          const naluLen = dv.getUint16(p)
          p += 2
          if (p + naluLen > end) break
          const data = new Uint8Array(buffer, p, naluLen)
          arr.push({ data })
          p += naluLen
        }

        nalu_arrays.push(arr)
        console.log('[MP4Demux] hvcC array: type=' + naluType +
          ' (' + ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'VPS', 'SPS', 'PPS'][naluType] + ')' +
          ', count=' + arr.length)
      }

      return { lengthSizeMinusOne, nalu_arrays }
    } catch (error) {
      console.warn('[MP4Demux] Error parsing hvcC box:', error)
      return null
    }
  }

  /**
   * Find moov box offset in the buffer
   */
  findMoovOffset() {
    const buffer = this.fullBuffer
    const view = new Uint8Array(buffer)
    let offset = 0

    while (offset + 8 < buffer.byteLength) {
      const sizeBytes = new Uint8Array(buffer, offset, 4)
      const size = (sizeBytes[0] << 24) | (sizeBytes[1] << 16) | (sizeBytes[2] << 8) | sizeBytes[3]

      const typeBytes = new Uint8Array(buffer, offset + 4, 4)
      const type = String.fromCharCode(typeBytes[0], typeBytes[1], typeBytes[2], typeBytes[3])

      if (type === 'moov') {
        console.log('[MP4Demux] Found moov at offset:', offset)
        return offset
      }

      if (size === 0 || size < 8) break
      offset += size
    }

    return -1
  }

  /**
   * Find video track offset within moov box
   */
  findVideoTrackOffset(moovOffset) {
    const buffer = this.fullBuffer
    const moovSize = ((new Uint8Array(buffer, moovOffset, 4)[0] << 24) |
                      (new Uint8Array(buffer, moovOffset + 1, 1)[0] << 16) |
                      (new Uint8Array(buffer, moovOffset + 2, 1)[0] << 8) |
                      new Uint8Array(buffer, moovOffset + 3, 1)[0])

    const moovEnd = moovOffset + moovSize
    let offset = moovOffset + 8

    while (offset + 8 < moovEnd) {
      const sizeBytes = new Uint8Array(buffer, offset, 4)
      const size = (sizeBytes[0] << 24) | (sizeBytes[1] << 16) | (sizeBytes[2] << 8) | sizeBytes[3]

      const typeBytes = new Uint8Array(buffer, offset + 4, 4)
      const type = String.fromCharCode(typeBytes[0], typeBytes[1], typeBytes[2], typeBytes[3])

      if (type === 'trak') {
        // Check if this is a video track
        if (this.isVideoTrack(offset, offset + size)) {
          console.log('[MP4Demux] Found video track at offset:', offset)
          return offset
        }
      }

      if (size === 0 || size < 8) break
      offset += size
    }

    return -1
  }

  /**
   * Check if a trak box is a video track
   */
  isVideoTrack(trakStart, trakEnd) {
    const buffer = this.fullBuffer
    let offset = trakStart + 8

    while (offset + 8 < trakEnd) {
      const sizeBytes = new Uint8Array(buffer, offset, 4)
      const size = (sizeBytes[0] << 24) | (sizeBytes[1] << 16) | (sizeBytes[2] << 8) | sizeBytes[3]

      const typeBytes = new Uint8Array(buffer, offset + 4, 4)
      const type = String.fromCharCode(typeBytes[0], typeBytes[1], typeBytes[2], typeBytes[3])

      if (type === 'mdia') {
        // Look for hdlr inside mdia
        const mdiaEnd = offset + size
        let mdiaOffset = offset + 8

        while (mdiaOffset + 8 < mdiaEnd) {
          const mdiaSize = ((new Uint8Array(buffer, mdiaOffset, 4)[0] << 24) |
                           (new Uint8Array(buffer, mdiaOffset + 1, 1)[0] << 16) |
                           (new Uint8Array(buffer, mdiaOffset + 2, 1)[0] << 8) |
                           new Uint8Array(buffer, mdiaOffset + 3, 1)[0])

          const mdiaType = String.fromCharCode(
            new Uint8Array(buffer, mdiaOffset + 4, 1)[0],
            new Uint8Array(buffer, mdiaOffset + 5, 1)[0],
            new Uint8Array(buffer, mdiaOffset + 6, 1)[0],
            new Uint8Array(buffer, mdiaOffset + 7, 1)[0]
          )

          if (mdiaType === 'hdlr') {
            const handlerType = String.fromCharCode(
              new Uint8Array(buffer, mdiaOffset + 16, 1)[0],
              new Uint8Array(buffer, mdiaOffset + 17, 1)[0],
              new Uint8Array(buffer, mdiaOffset + 18, 1)[0],
              new Uint8Array(buffer, mdiaOffset + 19, 1)[0]
            )
            return handlerType === 'vide'
          }

          if (mdiaSize === 0 || mdiaSize < 8) break
          mdiaOffset += mdiaSize
        }
      }

      if (size === 0 || size < 8) break
      offset += size
    }

    return false
  }

  /**
   * Process extracted samples and send to decoder
   * Uses batched async processing to avoid blocking the worker
   */
  processExtractedSamples(samples) {
    console.log('[MP4Demux] processExtractedSamples:', samples.length, 'samples')
    const BATCH_SIZE = 5
    let offset = 0

    const processBatch = () => {
      const pesList = []
      const end = Math.min(offset + BATCH_SIZE, samples.length)

      for (let i = offset; i < end; i++) {
        const sample = samples[i]
        const sampleData = this.sampleExtractor.getSampleData(sample)
        if (!sampleData) continue

        const data = this.convertExtractedSampleToAnnexB(sampleData, sample.is_sync)
        const pts = Math.round(sample.compositionTime * 1000 / sample.timescale)
        this.maxVideoPTS = Math.max(this.maxVideoPTS, pts)

        pesList.push({
          PTS: pts,
          data_byte: data,
          partEnd: false,
          lastTS: false
        })
      }

      if (pesList.length > 0) {
        // Mark last sample of last batch
        if (offset + BATCH_SIZE >= samples.length && pesList.length > 0) {
          pesList[pesList.length - 1].partEnd = true
          pesList[pesList.length - 1].lastTS = true
        }
        this.decode.push(pesList)
      }

      offset = end
      if (offset < samples.length) {
        setTimeout(processBatch, 16) // ~60fps pacing
      }
    }

    processBatch()
  }

  /**
   * Convert extracted sample data to Annex-B format
   * This converts from MP4 length-prefixed format to NALU format with start codes
   */
  convertExtractedSampleToAnnexB(data, isSyncSample) {
    const lengthSize = (this.hvcc && this.hvcc.lengthSizeMinusOne !== undefined)
      ? (this.hvcc.lengthSizeMinusOne + 1)
      : 4

    const units = []

    // Prepend VPS/SPS/PPS for key frames
    if (isSyncSample && this.hvcc && this.hvcc.nalu_arrays) {
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

    // Parse length-prefixed NALUs from sample data
    let offset = 0
    while (offset + lengthSize <= data.byteLength) {
      let len = 0
      for (let i = 0; i < lengthSize; i++) {
        len = (len << 8) | data[offset + i]
      }
      offset += lengthSize

      if (len <= 0 || offset + len > data.byteLength) break

      units.push(this.withStartCode(data.subarray(offset, offset + len)))
      offset += len
    }

    return this.concatUint8(units)
  }

  flush() {
    if (this.mp4boxfile) {
      try {
        this.mp4boxfile.flush()
      } catch (e) {
        console.warn('MP4Demux.flush: error', e.message)
      }
    }
  }
}

export default MP4Demux

