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
    console.log('[MP4Demux] MP4Box available, creating file instance')
    // Create file with chunked: false to indicate we're loading a complete file at once
    this.mp4boxfile = MP4Box.createFile({
      chunked: false
    })
    console.log('[MP4Demux] MP4Box file created:', this.mp4boxfile)

    this.mp4boxfile.onReady = (info) => {
      console.log('[MP4Demux] onReady called with info:', info)
      this.initialized = true
      try {
        if (info.videoTracks && info.videoTracks.length) {
          const trak = this.mp4boxfile.moov.traks.find(
            t => t.tkhd.track_id === info.videoTracks[0].id
          )
          console.log('[MP4Demux] Found video trak:', trak)
          if (trak && trak.mdia && trak.mdia.minf && trak.mdia.minf.stbl) {
            const stbl = trak.mdia.minf.stbl
            const stsd = stbl.stsd
            if (stsd && stsd.entries && stsd.entries.length > 0) {
              const entry = stsd.entries[0]
              this.hvcc = entry.hvcC
            }
          }
          this.videoTrackId = info.videoTracks[0].id

          // Try setExtractionOptions, but don't fail if it throws
          try {
            console.log('[MP4Demux] Setting extraction options for video track')
            this.mp4boxfile.setExtractionOptions(this.videoTrackId, null, {
              nbSamples: info.videoTracks[0].nb_samples,
              rapAlignment: true
            })
          } catch (e) {
            console.warn('[MP4Demux] setExtractionOptions failed:', e.message)
            // Continue anyway - onExtractSamples will be called if samples are available
          }
        }

        if (info.audioTracks && info.audioTracks.length) {
          this.audioTrackId = info.audioTracks[0].id
          try {
            this.mp4boxfile.setExtractionOptions(this.audioTrackId, null, {
              nbSamples: info.audioTracks[0].nb_samples,
              rapAlignment: true
            })
          } catch (e) {
            console.warn('[MP4Demux] setExtractionOptions for audio failed:', e.message)
          }
        }

        // Try to start, but don't fail if it throws
        try {
          console.log('[MP4Demux] Calling start()')
          this.mp4boxfile.start()
        } catch (e) {
          console.warn('[MP4Demux] start() failed:', e.message)
        }
      } catch (e) {
        console.error('[MP4Demux] Error in onReady callback:', e)
      }
    }

    this.mp4boxfile.onSamples = (id, user, samples) => {
      console.log('[MP4Demux] onSamples called:', { id, samplesCount: samples?.length })
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
    if (!buffer || !this.mp4boxfile) {
      console.warn('MP4Demux.push: buffer or mp4boxfile is null/undefined')
      return
    }

    // Convert various buffer types to ArrayBuffer
    let ab = null

    if (buffer instanceof ArrayBuffer) {
      ab = buffer
    } else if (buffer instanceof Uint8Array) {
      ab = buffer.buffer
    } else if (ArrayBuffer.isView(buffer)) {
      ab = buffer.buffer
    } else if (buffer && buffer.buffer instanceof ArrayBuffer) {
      ab = buffer.buffer
    } else {
      console.error('MP4Demux: Unsupported buffer type', buffer?.constructor?.name)
      return
    }

    if (!ab || ab.byteLength === 0) {
      console.warn('MP4Demux.push: ab is null or empty')
      return
    }

    // Store complete buffer for fallback extraction
    if (!this.fullBuffer) {
      this.fullBuffer = ab
    }

    // Verify buffer is valid
    const view = new Uint8Array(ab, 0, Math.min(16, ab.byteLength))
    const firstBoxType = String.fromCharCode(view[4], view[5], view[6], view[7])
    console.log('MP4Demux.push: First box type:', firstBoxType, 'Buffer size:', ab.byteLength)

    ab.fileStart = this.fileStart
    this.fileStart += ab.byteLength

    try {
      console.log('MP4Demux.push: appendBuffer with size:', ab.byteLength)

      let appendSuccess = false
      try {
        this.mp4boxfile.appendBuffer(ab)
        appendSuccess = true
        console.log('MP4Demux.push: appendBuffer succeeded')
      } catch (e1) {
        console.warn('MP4Demux: appendBuffer threw error:', e1.message)
        console.warn('MP4Demux: mp4box.js failed, will use manual sample extraction as fallback')

        // Trigger fallback sample extraction
        this.useFallbackSampleExtraction()
      }

      // Always try to flush
      if (!this.usingSampleExtractor) {
        try {
          console.log('MP4Demux.push: calling flush...')
          this.mp4boxfile.flush()
          console.log('MP4Demux.push: flush succeeded')
        } catch (e2) {
          console.warn('MP4Demux.push: flush also threw error:', e2.message)
        }
      }

      console.log('MP4Demux.push: completed (usingFallback:', this.usingSampleExtractor, ')')
    } catch (error) {
      console.error('MP4Demux: Unrecoverable error in push:', error?.message)
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
      // stsd format: version (1) + flags (3) + entry count (4) + entries
      const entryCount = ((new Uint8Array(buffer, stsdStart + 12, 4)[0] << 24) |
                          (new Uint8Array(buffer, stsdStart + 13, 4)[0] << 16) |
                          (new Uint8Array(buffer, stsdStart + 14, 4)[0] << 8) |
                          new Uint8Array(buffer, stsdStart + 15, 4)[0])

      if (entryCount === 0) return null

      // First entry starts at offset 16 from stsd start
      let entryOffset = stsdStart + 16
      let offset = entryOffset + 8  // Skip entry size and type

      // Look for hvcC box inside the entry
      const entryEnd = entryOffset + ((new Uint8Array(buffer, entryOffset, 4)[0] << 24) |
                                       (new Uint8Array(buffer, entryOffset + 1, 4)[0] << 16) |
                                       (new Uint8Array(buffer, entryOffset + 2, 4)[0] << 8) |
                                       new Uint8Array(buffer, entryOffset + 3, 4)[0])

      while (offset + 8 < entryEnd) {
        const sizeBytes = new Uint8Array(buffer, offset, 4)
        const size = (sizeBytes[0] << 24) | (sizeBytes[1] << 16) | (sizeBytes[2] << 8) | sizeBytes[3]

        const typeBytes = new Uint8Array(buffer, offset + 4, 4)
        const type = String.fromCharCode(typeBytes[0], typeBytes[1], typeBytes[2], typeBytes[3])

        if (type === 'hvcC') {
          // Parse hvcC box
          // hvcC structure: configurationVersion (1) + profile info (1) + constraints (6) + level (1) + reserved (4) + size info (2) + array count (1) + arrays
          const hvccOffset = offset + 8
          const lengthSizeMinusOne = (new Uint8Array(buffer, hvccOffset + 20, 1)[0]) & 0x03
          console.log('[MP4Demux] Parsed hvcC lengthSizeMinusOne:', lengthSizeMinusOne)

          return {
            lengthSizeMinusOne,
            nalu_arrays: []  // For now, empty arrays - would need more complex parsing
          }
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
   */
  processExtractedSamples(samples) {
    console.log('[MP4Demux] processExtractedSamples: starting with', samples.length, 'samples')
    const pesList = []

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i]
      const sampleData = this.sampleExtractor.getSampleData(sample)
      if (!sampleData) {
        console.warn('[MP4Demux] Could not get data for sample:', sample.index)
        continue
      }

      console.log('[MP4Demux] Processing sample:', {
        index: sample.index,
        dataSize: sampleData.byteLength,
        is_sync: sample.is_sync,
        decodingTime: sample.decodingTime,
        compositionTime: sample.compositionTime
      })

      // Convert to Annex-B format
      const data = this.convertExtractedSampleToAnnexB(sampleData, sample.is_sync)

      const pts = Math.round(sample.compositionTime * 1000 / sample.timescale)
      this.maxVideoPTS = Math.max(this.maxVideoPTS, pts)

      pesList.push({
        PTS: pts,
        data_byte: data,
        partEnd: false,
        lastTS: false
      })

      // Send samples in batches to avoid overwhelming the decoder
      if (pesList.length >= 10) {
        console.log('[MP4Demux] Sending batch of', pesList.length, 'samples to decoder')
        this.decode.push(pesList)
        pesList.length = 0
      }
    }

    // Send remaining samples
    if (pesList.length > 0) {
      console.log('[MP4Demux] Sending final batch of', pesList.length, 'samples to decoder')
      this.decode.push(pesList)
    }

    console.log('[MP4Demux] Processed all samples, maxVideoPTS:', this.maxVideoPTS)
  }

  /**
   * Convert extracted sample data to Annex-B format
   * This converts from MP4 length-prefixed format to NALU format with start codes
   */
  convertExtractedSampleToAnnexB(data, isSyncSample) {
    // Fix: properly check if lengthSizeMinusOne is defined (could be 0)
    const lengthSize = (this.hvcc && this.hvcc.lengthSizeMinusOne !== undefined)
      ? (this.hvcc.lengthSizeMinusOne + 1)
      : 4

    console.log('[MP4Demux] convertExtractedSampleToAnnexB:', {
      dataSize: data.byteLength,
      lengthSize,
      isSyncSample,
      hasHvcc: !!this.hvcc,
      hvccLengthSizeMinusOne: this.hvcc?.lengthSizeMinusOne,
      nalu_arrays: this.hvcc?.nalu_arrays?.length || 0
    })

    const units = []

    // Prepend VPS/SPS/PPS for key frames
    if (isSyncSample && this.hvcc && this.hvcc.nalu_arrays) {
      console.log('[MP4Demux] Adding VPS/SPS/PPS for keyframe')
      let headerCount = 0
      this.hvcc.nalu_arrays.forEach(arr => {
        if ([32, 33, 34].includes(arr.nalu_type)) {
          arr.forEach(n => {
            if (n && n.data) {
              console.log('[MP4Demux] Adding NALU type', arr.nalu_type, 'size', n.data.byteLength)
              units.push(this.withStartCode(n.data))
              headerCount++
            }
          })
        }
      })
      console.log('[MP4Demux] Added', headerCount, 'header NALUs')
    }

    // Parse length-prefixed NALUs from sample data
    let offset = 0
    let naluCount = 0
    while (offset + lengthSize <= data.byteLength) {
      let len = 0
      // Read length as big-endian integer
      for (let i = 0; i < lengthSize; i++) {
        len = (len << 8) | data[offset + i]
      }
      offset += lengthSize

      if (len <= 0) {
        console.warn('[MP4Demux] Invalid NALU length:', len, 'at offset:', offset - lengthSize)
        break
      }

      if (offset + len > data.byteLength) {
        console.warn('[MP4Demux] NALU extends beyond data:', {
          offset,
          naluLength: len,
          dataSize: data.byteLength,
          required: offset + len
        })
        break
      }

      const nalu = data.subarray(offset, offset + len)
      const naluType = (nalu[0] >> 1) & 0x3F // Extract NALU type from H.265
      console.log('[MP4Demux] NALU #' + naluCount + ':', {
        type: naluType,
        length: len,
        offset: offset - lengthSize
      })

      units.push(this.withStartCode(nalu))
      offset += len
      naluCount++
    }

    console.log('[MP4Demux] Parsed', naluCount, 'NALUs from sample, total units:', units.length)

    const result = this.concatUint8(units)
    console.log('[MP4Demux] Final Annex-B size:', result.byteLength)
    return result
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

