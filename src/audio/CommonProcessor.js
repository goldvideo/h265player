/**
 * @copyright: Copyright (C) 2019
 * @desc: process audio data of normal speed 
 * @author: xuluying 
 * @file: CommonProcessor.js
 */

import BaseClass from "../base/BaseClass";

export default class CommonProcessor extends BaseClass {
    source = []
    // Read pointer — index into source array (non-destructive consumption)
    readIndex = 0
    onPlay
    constructor(options) {
        super(options)
        this.source = options.source
        this.onPlay = options.onPlay
        this.init()
    }
    init() {
    }
    extract(target, numFrames) {
        let data = this.provide(numFrames)
        for(let i=0; i< data.size; i++) {
            target[i * 2] = data.left[i];
            target[i * 2 + 1] = data.right[i];
        }
        return data.size
    }
    /**
     * Seek the read pointer to the buffer containing the given time (seconds).
     * Returns true if a matching buffer was found.
     */
    seekTo(time) {
        for (let i = 0; i < this.source.length; i++) {
            let buf = this.source[i]
            if (buf.startTime <= time && buf.startTime + buf.duration > time) {
                this.readIndex = i
                buf.loadedPosition = parseInt(buf.length * (time - buf.startTime) / buf.duration)
                return true
            }
        }
        // If time is before all buffers, reset to start
        if (this.source.length > 0 && time <= this.source[0].startTime) {
            this.readIndex = 0
            this.source[0].loadedPosition = 0
            return true
        }
        return false
    }
    /**
     * Trim (release) all buffers whose end time is before the given time (seconds).
     * This frees memory for long-running playback.
     */
    trim(time) {
        let trimCount = 0
        for (let i = 0; i < this.source.length; i++) {
            if (this.source[i].startTime + this.source[i].duration < time) {
                trimCount = i + 1
            } else {
                break
            }
        }
        if (trimCount > 0) {
            this.source.splice(0, trimCount)
            this.readIndex = Math.max(0, this.readIndex - trimCount)
        }
    }
    provide(size) {
        let sourceSize = size
        let leftSource = new Float32Array(sourceSize)
        let rightSource = new Float32Array(sourceSize)
        let sourcePosition = 0
        let audioTime = 0
        let copySize = 0
        while(this.readIndex < this.source.length) {
            var tmpBuffer = this.source[this.readIndex]
            var loadedPosition = tmpBuffer.loadedPosition || 0
            audioTime = tmpBuffer.startTime + tmpBuffer.duration * loadedPosition / tmpBuffer.length
            let copyLength = Math.min(tmpBuffer.length - loadedPosition, sourceSize - sourcePosition)
            let leftBuffer = tmpBuffer.getChannelData(0)
            let rightBuffer = tmpBuffer.numberOfChannels > 1 ? tmpBuffer.getChannelData(1): tmpBuffer.getChannelData(0)
            //fill channel data with buffer
            leftSource.set(leftBuffer.slice(loadedPosition, loadedPosition + copyLength), sourcePosition)
            rightSource.set(rightBuffer.slice(loadedPosition, loadedPosition + copyLength), sourcePosition)
            copySize += copyLength
            loadedPosition += copyLength
            sourcePosition += copyLength
            if(loadedPosition < tmpBuffer.length) {
                tmpBuffer.loadedPosition = loadedPosition
                break;
            } else {
                // Buffer fully consumed — clear loadedPosition and advance pointer
                tmpBuffer.loadedPosition = 0
                this.readIndex++
            }
        }
        if(this.onPlay) {
            this.onPlay(audioTime)
        }
        return {
            left: leftSource,
            right: rightSource,
            size: copySize
        }
    }
}
