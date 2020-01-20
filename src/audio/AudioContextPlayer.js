/**
 * @copyright: Copyright (C) 2019
 * @desc: audioContext play audio data
 * @author: xuluying 
 * @file: AudioContextPlayer.js
 */

import BaseClass from "../base/BaseClass";
import AudioProvider from './AudioProvider';
import Element from '../toolkit/Element'

const EVENTS = {
    CANPLAY:  'canplaythrough',
    SEEKED: 'seeked',
    WAIT: 'waiting'
}

export default class AudioContextPlayer extends BaseClass {
    audioContext = null
    scriptNode = null
    gainNode = null
    delay = 0
    audioBuffer = new ArrayBuffer(0)
    decodedBuffer = []
    isFirstPlay = true
    defaultVolume = 1
    currentRate = 1
    eventListeners = {}
    canPlay = false
    interval
    seekTimeDelta = 0
    audioTime = 0
    audioProvider
    isWaiting = false
    constructor(options) {
        super(options)
        options = Object.assign({}, options)
        this.flushTime = options.flushTime || 1000
        this.onReady = options.onReady
        this.init()
    }
    init() {
        this.audioProvider = new AudioProvider({
            source: this.decodedBuffer
        })
        if (typeof this.onReady == 'function') {
            setTimeout(this.onReady, 0)
        }
    }
    feed({audio}) {
        this.audioBuffer = this.appendByteArray(this.audioBuffer, audio)
        if(!this.canPlay) {
            this.canPlay = true
            this.triggerEvent(EVENTS.CANPLAY)
        }
    }
    appendByteArray(buffer1, buffer2) {
        let tmp = new Uint8Array((buffer1.byteLength|0) + (buffer2.byteLength|0));
        tmp.set(new Uint8Array(buffer1), 0);
        tmp.set(new Uint8Array(buffer2), buffer1.byteLength|0);
        var res = tmp.buffer
        return res;
    }
    decodeAudioData(callback) {
        if(this.audioBuffer && this.audioBuffer.byteLength > 0) {
            this.audioContext.decodeAudioData(this.audioBuffer, buffer => {
                buffer.startTime = this.delay
                this.delay += buffer.duration
                this.decodedBuffer.push(buffer)
                if(callback) {
                    callback.call()
                }
            }, err => {
                this.logger.error('decodeAudioData', err)
            })
            this.audioBuffer = new ArrayBuffer(0)
        }
    }
    play() {
        return new Promise((resolve, reject) => {
            if(this.isFirstPlay) {
                this.isFirstPlay = false
                this.logger.info('startPlay')
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.gainNode = this.audioContext.createGain()
                this.gainNode.gain.value = this.defaultVolume
                this.scriptNode = this.audioContext.createScriptProcessor(2048, 2, 2);
                this.scriptNode.onaudioprocess = audioProcessingEvent=> {
                    let outputBuffer = audioProcessingEvent.outputBuffer;
                    let sourceSize = outputBuffer.length
                    let audioData = this.audioProvider.provide(sourceSize)
                    if(audioData.size === 0) {
                        if(!this.isWaiting) {
                            this.isWaiting = true
                            this.triggerEvent(EVENTS.WAIT)
                        }
                        return
                    } else {
                        if(this.isWaiting) {
                            this.isWaiting = false
                            this.triggerEvent(EVENTS.CANPLAY)
                        }
                    }
                    let leftDst = outputBuffer.getChannelData(0)
                    let rightDst = outputBuffer.getChannelData(1)
                    if(audioData.audioTime != 0) {
                        this.audioTime = audioData.audioTime
                    }
                    leftDst.set(audioData.left)
                    rightDst.set(audioData.right)
                    if(audioData.size < sourceSize) {
                        let emptyArray = new Float32Array(sourceSize - audioData.size)
                        leftDst.set(emptyArray, audioData.size)
                        rightDst.set(emptyArray, audioData.size)
                    }
                }
                this.scriptNode.connect(this.gainNode)
                this.gainNode.connect(this.audioContext.destination);
                this.decodeAudioData.call(this, this.testAutoplay.bind(this, resolve, reject))
                this.interval = setInterval(this.decodeAudioData.bind(this), this.flushTime)
            } else {
                if(this.audioContext.state === 'suspended') {
                    this.audioContext.resume().then(()=> {
                        this.logger.info('play', 'Audio is resumed')
                        resolve()
                    })
                } else {
                    // resumed from wait
                    this.logger.info('Audio resumed from waiting')
                    resolve()
                }
            }
        })
    }
    get currentTime() {
        return this.audioTime
    }
    set currentTime(time) {
        this.audioTime = time
        while(this.decodedBuffer.length > 0) {
            let tmpBuffer = this.decodedBuffer.shift()
            if(tmpBuffer.startTime <= time && tmpBuffer.startTime + tmpBuffer.duration > time) {
                tmpBuffer.loadedPosition = parseInt(tmpBuffer.length * (time - tmpBuffer.startTime) / tmpBuffer.duration)
                this.decodedBuffer.unshift(tmpBuffer)
                break;
            }
        }
        //sync trigger seeked event
        setTimeout(() => {
            this.triggerEvent(EVENTS.SEEKED)
        }, 0);
    }
    pause() {
        if(this.audioContext) {
            this.audioContext.suspend().then(()=> {
                this.logger.info('pause', 'Audio is paused')
            })
        }
    }
    addEventListener(type, handler) {
        this.eventListeners[type] = handler
    }
    triggerEvent(type) {
        var handler = this.eventListeners[type]
        if(handler) {
            handler.call()
        }
    }
    buffer() {
        let start = 0
        if(this.decodedBuffer.length > 0) {
            let tmp = this.decodedBuffer[0]
            start = tmp.startTime
        }
        return {
            start: start * 1000,
            end: parseInt(this.delay * 1000)
        }
    }
    get volume() {
        return this.gainNode.gain.value
    }
    set volume(value) {
        if(this.gainNode) {
            this.gainNode.gain.value = value
        } else {
            this.defaultVolume = value
        }
    }
    destroy() {
        this.delay = 0
        if(this.audioContext) {
            clearInterval(this.interval)
            // Fix get currentTime after reset
            this.scriptNode.disconnect()
            this.scriptNode = null
            this.audioContext.close()
            this.audioContext = null
        }
        this.gainNode = null
        this.audioBuffer = new ArrayBuffer(0)
        this.canPlay = false
        this.isFirstPlay = true
        this.decodedBuffer.length = 0
        this.seekTimeDelta = 0
        this.audioTime = 0
    }
    set playbackRate(value) {
        if(value !== this.currentRate) {
            this.currentRate = value
            this.audioProvider.rate = value
        }
    }
    testAutoplay(resolve, reject) {
        let audio = Element.createEl('audio')
        let promise = audio.play();
        audio = null;
        let isRejected = false
        if (promise !== undefined) {
            promise.catch(() => {
                isRejected = true
            });
            setTimeout(()=> {
                promise = null
                if(isRejected) {
                    reject('Autoplay is prevented')
                } else {
                    resolve()
                }
            }, 100)
        } else {
            reject('Promise is undefined')
        }
    }
}