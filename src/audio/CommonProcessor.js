/**
 * @copyright: Copyright (C) 2019
 * @desc: process audio data of normal speed 
 * @author: xuluying 
 * @file: CommonProcessor.js
 */

import BaseClass from "../base/BaseClass";

export default class CommonProcessor extends BaseClass {
    source = []
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
        // console.error('[Common] buffer size = %d, request size = %d, response size = %d,  ',this.source.length, numFrames, data.size)
        for(let i=0; i< data.size; i++) {
            target[i * 2] = data.left[i];
            target[i * 2 + 1] = data.right[i];
        }
        return data.size
    }
    provide(size) {
        let sourceSize = size
        let leftSource = new Float32Array(sourceSize)
        let rightSource = new Float32Array(sourceSize)
        let sourcePosition = 0
        let audioTime = 0
        let copySize = 0
        while(this.source.length > 0) {
            var tmpBuffer = this.source.shift();
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
                this.source.unshift(tmpBuffer)
                break;
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