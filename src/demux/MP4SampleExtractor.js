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
          timescale: this.timescale
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
