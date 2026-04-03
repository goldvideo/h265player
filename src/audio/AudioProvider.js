/**
 * @copyright: Copyright (C) 2019
 * @desc: manage pcm data
 * @author: xuluying 
 * @file: AudioProvider.js
 */

import BaseClass from "../base/BaseClass";
import CommonProcessor from "./CommonProcessor";
import RateProcessor from './RateProcessor';

export default class AudioProvider extends BaseClass {
    currentRate = 1
    source = []
    commonProcessor
    rateProcessor
    audioTime = 0
    constructor(options) {
        super(options)
        this.source = options.source
        this.init()
    }
    init() {
        this.commonProcessor = new CommonProcessor({
            source: this.source,
            onPlay: (time)=> {
                this.audioTime = time
            }
        })
        this.rateProcessor = new RateProcessor({
            source: this.commonProcessor
        })
    }
    set rate(value) {
        this.currentRate = value
        this.rateProcessor.rate = value
    }
    /**
     * Seek the read pointer to the given time (seconds).
     */
    seekTo(time) {
        return this.commonProcessor.seekTo(time)
    }
    /**
     * Trim buffers before the given time (seconds) to free memory.
     */
    trim(time) {
        this.commonProcessor.trim(time)
    }
    provide(size) {
        let provider = this.currentRate === 1 ? this.commonProcessor: this.rateProcessor
        let audioData = provider.provide(size)
        audioData.audioTime = this.audioTime
        return audioData
    }
}
