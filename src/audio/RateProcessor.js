/**
 * @copyright: Copyright (C) 2019
 * @desc: process audio data of rate speed
 * @author: xuluying 
 * @file: RateProcessor.js
 */

import BaseClass from "../base/BaseClass";
import { SoundTouch, SimpleFilter } from '../lib/soundtouch';

export default class RateProcessor extends BaseClass {
    soundTouch
    filter
    constructor(options) {
        super(options)
        this.init(options.source)
    }
    init(source) {
        this.soundTouch = new SoundTouch()
        this.soundTouch.tempo = 1
        this.soundTouch.rate = 1
        this.filter = new SimpleFilter(source, this.soundTouch, 2048)
    }
    set rate(value) {
        this.soundTouch.tempo = value;
    }
    provide(size) {
        let target = new Float32Array(size * 2);
        let framesExtracted = this.filter.extract(target, size);
        // console.error('[Rate] request size = %d, response size = %d', size, framesExtracted)
        let left = new Float32Array(framesExtracted);
        let right = new Float32Array(framesExtracted);
        for(let i=0; i<framesExtracted; i++) {
            left[i] = target[i * 2];
            right[i] = target[i * 2 + 1]
        }
        return {
            size: framesExtracted,
            left,
            right,
        }
    }
}