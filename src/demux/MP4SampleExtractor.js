/**
 * MP4 Sample Extractor - Extract video samples directly from MP4 structure
 * Used as fallback when mp4box.js fails
 *
 * Parses Sample Table Box (STBL) to extract:
 * - Sample decode times (STTS)
 * - Chunk offsets (STCO/CO64)
 * - Sample sizes (STSZ)
 * - Composition times (CTTS)
 * - Keyframe info (STSS)
 */
class MP4SampleExtractor {
  constructor(buffer, moovOffset, moovSize, hvcc) {
    this.buffer = buffer
    this.moovOffset = moovOffset
    this.moovSize = moovSize
    this.hvcc = hvcc
    this.dataView = new DataView(buffer)
    this.samples = []
    this.timescale = 1000
    this.mdatOffset = null
    this.videoTrackOffset = null
  }

  /**
   * Read 32-bit big-endian integer
   */
  readUint32(offset) {
    return this.dataView.getUint32(offset, false)
  }

  /**
   * Read 64-bit big-endian integer
   */
  readUint64(offset) {
    const high = this.readUint32(offset)
    const low = this.readUint32(offset + 4)
    if (high === 0) {
      return low
    }
    try {
      return Number((BigInt(high) << BigInt(32)) | BigInt(low))
    } catch (e) {
      return (high * 0x100000000) + low
    }
  }

  /**
   * Read 32-bit unsigned integer in little-endian (for fixed point)
   */
  readUint16(offset) {
    return this.dataView.getUint16(offset, false)
  }

  /**
   * Read 8-bit unsigned integer
   */
  readUint8(offset) {
    return this.dataView.getUint8(offset)
  }

  /**
   * Read box type (4 ASCII bytes)
   */
  readBoxType(offset) {
    const chars = []
    for (let i = 0; i < 4; i++) {
      chars.push(String.fromCharCode(this.readUint8(offset + i)))
    }
    return chars.join('')
  }

  /**
   * Find mdat box offset
   */
  findMdatOffset() {
    let offset = 0
    while (offset + 8 < this.buffer.byteLength) {
      const size = this.readUint32(offset)
      const type = this.readBoxType(offset + 4)

      if (type === 'mdat') {
        this.mdatOffset = offset
        return offset
      }

      if (size === 0) break
      if (size < 8) break

      offset += size
    }
    return null
  }

  /**
   * Extract samples from STBL structure
   */
  extractSamples(videoTrackOffset) {
    try {
      // Find mdat offset first
      this.findMdatOffset()
      if (!this.mdatOffset) {
        console.error('[MP4SampleExtractor] No mdat box found')
        return []
      }

      // Parse STBL from video track
      const stblOffset = this.findSTBLOffset(videoTrackOffset)
      if (!stblOffset) {
        console.error('[MP4SampleExtractor] No STBL found')
        return []
      }

      // Extract tables from STBL
      const sttsData = this.extractSTTS(stblOffset)
      const stscData = this.extractSTSC(stblOffset)
      const stszData = this.extractSTSZ(stblOffset)
      const stcoData = this.extractSTCO(stblOffset)
      const cttsData = this.extractCTTS(stblOffset)
      const stssData = this.extractSTSS(stblOffset)

      if (!sttsData || !stscData || !stszData || !stcoData) {
        console.error('[MP4SampleExtractor] Missing required sample tables')
        return []
      }

      console.log('[MP4SampleExtractor] Extracted tables:', {
        sttsCount: sttsData.length,
        stscCount: stscData.length,
        stszCount: stszData.length,
        stcoCount: stcoData.length,
        cttsCount: cttsData ? cttsData.length : 0,
        stssCount: stssData ? stssData.length : 0
      })

      // Build sample list
      this.buildSampleList(sttsData, stscData, stszData, stcoData, cttsData, stssData)

      return this.samples
    } catch (error) {
      console.error('[MP4SampleExtractor] Error extracting samples:', error)
      return []
    }
  }

  /**
   * Find STBL (Sample Table Box) offset in video track
   */
  findSTBLOffset(videoTrackOffset) {
    const trakEnd = videoTrackOffset + this.readUint32(videoTrackOffset)
    let offset = videoTrackOffset + 8

    while (offset < trakEnd) {
      if (offset + 8 > this.buffer.byteLength) break

      const size = this.readUint32(offset)
      const type = this.readBoxType(offset + 4)

      if (type === 'mdia') {
        // Find STBL inside mdia
        const mdiaEnd = offset + size
        let mdiaOffset = offset + 8

        while (mdiaOffset < mdiaEnd) {
          if (mdiaOffset + 8 > this.buffer.byteLength) break

          const mdiaSize = this.readUint32(mdiaOffset)
          const mdiaType = this.readBoxType(mdiaOffset + 4)

          if (mdiaType === 'mdhd') {
            this.parseMDHD(mdiaOffset)
          }

          if (mdiaType === 'minf') {
            // Find STBL inside minf
            const minfEnd = mdiaOffset + mdiaSize
            let minfOffset = mdiaOffset + 8

            while (minfOffset < minfEnd) {
              if (minfOffset + 8 > this.buffer.byteLength) break

              const minfSize = this.readUint32(minfOffset)
              const minfType = this.readBoxType(minfOffset + 4)

              if (minfType === 'stbl') {
                return minfOffset
              }

              if (minfSize === 0) break
              minfOffset += minfSize
            }
          }

          if (mdiaSize === 0) break
          mdiaOffset += mdiaSize
        }
      }

      if (size === 0) break
      offset += size
    }

    return null
  }

  /**
   * Parse Media Header Box (mdhd) to get correct timescale
   */
  parseMDHD(offset) {
    const version = this.readUint8(offset + 8)
    let timeOffset = offset + 12
    if (version === 0) {
      // version 0: creation_time(4) + modification_time(4) + timescale(4)
      this.timescale = this.readUint32(timeOffset + 8)
    } else {
      // version 1: creation_time(8) + modification_time(8) + timescale(4)
      this.timescale = this.readUint32(timeOffset + 16)
    }
    console.log('[MP4SampleExtractor] Parsed mdhd timescale:', this.timescale)
  }

  /**
   * Extract STTS (Decoding Time-to-Sample Box)
   */
  extractSTTS(stblOffset) {
    const stblEnd = stblOffset + this.readUint32(stblOffset)
    let offset = stblOffset + 8

    while (offset < stblEnd) {
      if (offset + 8 > this.buffer.byteLength) break

      const size = this.readUint32(offset)
      const type = this.readBoxType(offset + 4)

      if (type === 'stts') {
        const entryCount = this.readUint32(offset + 12)
        const entries = []
        let entryOffset = offset + 16

        for (let i = 0; i < entryCount && entryOffset + 8 <= this.buffer.byteLength; i++) {
          entries.push({
            sampleCount: this.readUint32(entryOffset),
            sampleDelta: this.readUint32(entryOffset + 4)
          })
          entryOffset += 8
        }

        return entries
      }

      if (size === 0) break
      offset += size
    }

    return null
  }

  /**
   * Extract STSC (Sample-to-Chunk Box)
   */
  extractSTSC(stblOffset) {
    const stblEnd = stblOffset + this.readUint32(stblOffset)
    let offset = stblOffset + 8

    while (offset < stblEnd) {
      if (offset + 8 > this.buffer.byteLength) break

      const size = this.readUint32(offset)
      const type = this.readBoxType(offset + 4)

      if (type === 'stsc') {
        const entryCount = this.readUint32(offset + 12)
        const entries = []
        let entryOffset = offset + 16

        for (let i = 0; i < entryCount && entryOffset + 12 <= this.buffer.byteLength; i++) {
          entries.push({
            firstChunk: this.readUint32(entryOffset),
            samplesPerChunk: this.readUint32(entryOffset + 4),
            sampleDescriptionIndex: this.readUint32(entryOffset + 8)
          })
          entryOffset += 12
        }

        return entries
      }

      if (size === 0) break
      offset += size
    }

    return null
  }

  /**
   * Extract STSZ (Sample Size Box)
   */
  extractSTSZ(stblOffset) {
    const stblEnd = stblOffset + this.readUint32(stblOffset)
    let offset = stblOffset + 8

    while (offset < stblEnd) {
      if (offset + 8 > this.buffer.byteLength) break

      const size = this.readUint32(offset)
      const type = this.readBoxType(offset + 4)

      if (type === 'stsz') {
        const uniformSize = this.readUint32(offset + 12)
        const sampleCount = this.readUint32(offset + 16)
        const sizes = []

        if (uniformSize !== 0) {
          // All samples have the same size
          for (let i = 0; i < sampleCount; i++) {
            sizes.push(uniformSize)
          }
        } else {
          // Variable sizes
          let sizeOffset = offset + 20
          for (let i = 0; i < sampleCount && sizeOffset + 4 <= this.buffer.byteLength; i++) {
            sizes.push(this.readUint32(sizeOffset))
            sizeOffset += 4
          }
        }

        return sizes
      }

      if (size === 0) break
      offset += size
    }

    return null
  }

  /**
   * Extract STCO/CO64 (Chunk Offset Box)
   */
  extractSTCO(stblOffset) {
    const stblEnd = stblOffset + this.readUint32(stblOffset)
    let offset = stblOffset + 8

    while (offset < stblEnd) {
      if (offset + 8 > this.buffer.byteLength) break

      const size = this.readUint32(offset)
      const type = this.readBoxType(offset + 4)

      if (type === 'stco' || type === 'co64') {
        const entryCount = this.readUint32(offset + 12)
        const offsets = []
        let entryOffset = offset + 16
        const is64bit = (type === 'co64')

        for (let i = 0; i < entryCount; i++) {
          if (is64bit) {
            if (entryOffset + 8 > this.buffer.byteLength) break
            offsets.push(this.readUint64(entryOffset))
            entryOffset += 8
          } else {
            if (entryOffset + 4 > this.buffer.byteLength) break
            offsets.push(this.readUint32(entryOffset))
            entryOffset += 4
          }
        }

        return offsets
      }

      if (size === 0) break
      offset += size
    }

    return null
  }

  /**
   * Extract CTTS (Composition Time-to-Sample Box)
   */
  extractCTTS(stblOffset) {
    const stblEnd = stblOffset + this.readUint32(stblOffset)
    let offset = stblOffset + 8

    while (offset < stblEnd) {
      if (offset + 8 > this.buffer.byteLength) break

      const size = this.readUint32(offset)
      const type = this.readBoxType(offset + 4)

      if (type === 'ctts') {
        const entryCount = this.readUint32(offset + 12)
        const entries = []
        let entryOffset = offset + 16

        for (let i = 0; i < entryCount && entryOffset + 8 <= this.buffer.byteLength; i++) {
          entries.push({
            sampleCount: this.readUint32(entryOffset),
            compositionOffset: this.readUint32(entryOffset + 4)
          })
          entryOffset += 8
        }

        return entries
      }

      if (size === 0) break
      offset += size
    }

    return null
  }

  /**
   * Extract STSS (Sync Sample Box) - keyframe info
   */
  extractSTSS(stblOffset) {
    const stblEnd = stblOffset + this.readUint32(stblOffset)
    let offset = stblOffset + 8

    while (offset < stblEnd) {
      if (offset + 8 > this.buffer.byteLength) break

      const size = this.readUint32(offset)
      const type = this.readBoxType(offset + 4)

      if (type === 'stss') {
        const entryCount = this.readUint32(offset + 12)
        const keyframes = new Set()
        let entryOffset = offset + 16

        for (let i = 0; i < entryCount && entryOffset + 4 <= this.buffer.byteLength; i++) {
          keyframes.add(this.readUint32(entryOffset) - 1) // 1-indexed to 0-indexed
          entryOffset += 4
        }

        return keyframes
      }

      if (size === 0) break
      offset += size
    }

    return null
  }

  /**
   * Parse hvcC box from stsd entry
   * Returns complete hvcC structure with nalu_arrays
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
          return this.parseHvcCBox(offset, offset + size, buffer)
        }

        if (size === 0 || size < 8) break
        offset += size
      }
    } catch (error) {
      console.warn('[MP4SampleExtractor] Error parsing hvcC from stsd:', error)
    }
    return null
  }

  /**
   * Parse hvcC box content
   */
  parseHvcCBox(hvccStart, hvccEnd, buffer) {
    try {
      let offset = hvccStart + 8  // Skip header

      // configurationVersion (1)
      const configurationVersion = this.readUint8(offset)
      offset += 1

      // profile_space (3 bits) + profile_idc (5 bits)
      const profile_info = this.readUint8(offset)
      const profile_idc = profile_info & 0x1F
      const profile_space = (profile_info >> 5) & 0x07
      offset += 1

      // general_profile_compatibility_flags (32 bits)
      offset += 4

      // constraint_flags (6 bits) + level_idc (8 bits)
      const level_info = this.readUint8(offset)
      const level_idc = level_info
      const constraint_flags = (level_info >> 6) & 0x3F
      offset += 1

      // reserved (2 bits) + lengthSizeMinusOne (2 bits)
      const lengthSizeMinusOne = (this.readUint8(offset) >> 6) & 0x03
      offset += 1

      // reserved + num_seq_parameter_sets (6 bits)
      const num_seq_parameter_sets = this.readUint8(offset) & 0x3F
      offset += 1

      const nalu_arrays = []

      // Parse sequence parameter sets (SPS)
      for (let i = 0; i < num_seq_parameter_sets; i++) {
        if (offset + 2 > hvccEnd) break
        const seq_param_set_length = this.readUint16(offset)
        offset += 2

        if (offset + seq_param_set_length > hvccEnd) break

        const nalu_data = new Uint8Array(buffer, offset, seq_param_set_length)
        nalu_arrays.push({
          nalu_type: 33,  // SPS type
          data: nalu_data
        })

        offset += seq_param_set_length
      }

      // Parse picture parameter sets (PPS)
      const num_pic_parameter_sets = this.readUint8(offset) & 0x1F
      offset += 1

      for (let i = 0; i < num_pic_parameter_sets; i++) {
        if (offset + 2 > hvccEnd) break
        const pic_param_set_length = this.readUint16(offset)
        offset += 2

        if (offset + pic_param_set_length > hvccEnd) break

        const nalu_data = new Uint8Array(buffer, offset, pic_param_set_length)
        nalu_arrays.push({
          nalu_type: 34,  // PPS type
          data: nalu_data
        })

        offset += pic_param_set_length
      }

      // Parse additional arrays (VPS, etc.)
      const num_additional_arrays = this.readUint8(offset)
      offset += 1

      for (let i = 0; i < num_additional_arrays; i++) {
        if (offset + 5 > hvccEnd) break

        // reserved (6 bits) + nal_unit_type (6 bits)
        const array_completeness = this.readUint8(offset) & 0x01
        const nal_unit_type = (this.readUint8(offset) >> 1) & 0x3F
        offset += 1

        const num_nalus = this.readUint16(offset)
        offset += 2

        for (let j = 0; j < num_nalus && offset + 2 <= hvccEnd; j++) {
          const nal_unit_length = this.readUint16(offset)
          offset += 2

          if (offset + nal_unit_length > hvccEnd) break

          const nalu_data = new Uint8Array(buffer, offset, nal_unit_length)
          nalu_arrays.push({
            nalu_type: nal_unit_type,
            data: nalu_data
          })

          offset += nal_unit_length
        }
      }

      console.log('[MP4SampleExtractor] Parsed hvcC:', {
        profile_idc,
        level_idc,
        lengthSizeMinusOne,
        nalu_arrays_count: nalu_arrays.length,
        sps_count: nalu_arrays.filter(a => a.nalu_type === 33).length,
        pps_count: nalu_arrays.filter(a => a.nalu_type === 34).length
      })

      return {
        lengthSizeMinusOne,
        nalu_arrays
      }
    } catch (error) {
      console.warn('[MP4SampleExtractor] Error parsing hvcC box:', error)
      return null
    }
  }

  /**
   * Build sample list from extracted tables
   */
  buildSampleList(sttsData, stscData, stszData, stcoData, cttsData, stssData) {
    this.samples = []

    // Calculate cumulative sample counts for STTS
    const sttsRunDurations = []
    let cumulativeSamples = 0
    for (const entry of sttsData) {
      cumulativeSamples += entry.sampleCount
      sttsRunDurations.push({
        cumulativeSamples,
        sampleDelta: entry.sampleDelta
      })
    }

    // Calculate cumulative sample counts for STSC
    const stscRuns = []
    let currentChunk = 1
    for (let i = 0; i < stscData.length; i++) {
      const entry = stscData[i]
      const nextFirstChunk = (i + 1 < stscData.length) ? stscData[i + 1].firstChunk : Infinity
      stscRuns.push({
        firstChunk: entry.firstChunk,
        nextFirstChunk,
        samplesPerChunk: entry.samplesPerChunk
      })
    }

    // Extract samples
    let sampleIndex = 0
    let decodingTime = 0
    let compositionTime = 0

    // Get keyframe set
    const keyframes = stssData || new Set()

    for (let chunkIndex = 0; chunkIndex < stcoData.length && sampleIndex < stszData.length; chunkIndex++) {
      // Find samples per chunk for this chunk
      let samplesPerChunk = 1
      for (const run of stscRuns) {
        if (chunkIndex + 1 >= run.firstChunk && chunkIndex + 1 < run.nextFirstChunk) {
          samplesPerChunk = run.samplesPerChunk
          break
        }
      }

      const chunkOffset = stcoData[chunkIndex]

      // Extract samples in this chunk
      let sampleOffsetInChunk = 0
      for (let s = 0; s < samplesPerChunk && sampleIndex < stszData.length; s++) {
        const sampleSize = stszData[sampleIndex]
        const sampleOffset = chunkOffset + sampleOffsetInChunk

        // Calculate decoding time
        let currentDelta = 1
        for (const run of sttsRunDurations) {
          if (sampleIndex < run.cumulativeSamples) {
            currentDelta = run.sampleDelta
            break
          }
        }
        decodingTime += currentDelta

        // Calculate composition time
        if (cttsData) {
          let cttsOffset = 0
          for (const entry of cttsData) {
            if (sampleIndex < cttsOffset + entry.sampleCount) {
              compositionTime = decodingTime + entry.compositionOffset
              break
            }
            cttsOffset += entry.sampleCount
          }
        } else {
          compositionTime = decodingTime
        }

        this.samples.push({
          index: sampleIndex,
          offset: sampleOffset,
          size: sampleSize,
          decodingTime,
          compositionTime,
          is_sync: keyframes.has(sampleIndex),
          timescale: this.timescale,
          cts: compositionTime,  // MP4Box uses 'cts' for composition time
          data: null  // Will be filled by getSampleData
        })

        sampleOffsetInChunk += sampleSize
        sampleIndex++
      }
    }

    console.log('[MP4SampleExtractor] Built sample list:', {
      totalSamples: this.samples.length,
      firstSample: this.samples[0],
      lastSample: this.samples[this.samples.length - 1]
    })
  }

  /**
   * Get sample data as Uint8Array
   */
  getSampleData(sample) {
    if (!sample || sample.offset < 0 || sample.size <= 0) {
      return null
    }

    if (sample.offset + sample.size > this.buffer.byteLength) {
      console.error('[MP4SampleExtractor] Sample offset out of bounds:', {
        offset: sample.offset,
        size: sample.size,
        bufferSize: this.buffer.byteLength
      })
      return null
    }

    return new Uint8Array(this.buffer, sample.offset, sample.size)
  }

  /**
   * Get all samples
   */
  getSamples() {
    return this.samples
  }
}

export default MP4SampleExtractor
