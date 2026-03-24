import AudioContextPlayer from '../src/audio/AudioContextPlayer'

const originalPlay = window.HTMLMediaElement.prototype.play
const originalAudioContext = window.AudioContext
const originalWebkitAudioContext = window.webkitAudioContext

class MockAudioContext {
    constructor() {
        this.state = 'running'
        this.destination = {}
    }
    createGain() {
        return {
            gain: {
                value: 1
            },
            connect: jest.fn()
        }
    }
    createScriptProcessor() {
        return {
            connect: jest.fn(),
            disconnect: jest.fn(),
            onaudioprocess: null
        }
    }
    decodeAudioData(audioData, successCallback) {
        successCallback({
            duration: 1,
            length: 1024
        })
        return Promise.resolve()
    }
    suspend() {
        this.state = 'suspended'
        return Promise.resolve()
    }
    resume() {
        this.state = 'running'
        return Promise.resolve()
    }
    close() {
        this.state = 'closed'
        return Promise.resolve()
    }
}

window.AudioContext = MockAudioContext
window.webkitAudioContext = MockAudioContext

test('Check API', () => {
    let audioPlayer = new AudioContextPlayer()
    // decoder API
    expect(audioPlayer.feed instanceof Function).toBe(true)
    expect(audioPlayer.destroy instanceof Function).toBe(true)
    // player API
    expect(audioPlayer.play instanceof Function).toBe(true)
    expect(audioPlayer.pause instanceof Function).toBe(true)
    expect(audioPlayer.buffer instanceof Function).toBe(true)
    expect(audioPlayer).toHaveProperty('playbackRate');
    expect(audioPlayer).toHaveProperty('currentTime');
    audioPlayer.gainNode = {
        gain: {}
    }
    expect(audioPlayer).toHaveProperty('volume');
})

test('Check Ready Callback', (done) => {
    const mockCallback = jest.fn(_=> {
        done()
    });
    let audioPlayer = new AudioContextPlayer({
        onReady: mockCallback
    })
})

describe('Test feed, decode and play', () => {
    let audioPlayer = null
    beforeEach(() => {
        audioPlayer = new AudioContextPlayer()
        const audio = new Uint8Array([1, 2, 3, 4]).buffer
        audioPlayer.feed({
            audio
        })
        expect(audioPlayer.audioBuffer.byteLength).toBe(audio.byteLength)
    });
    afterEach(() => {
        window.HTMLMediaElement.prototype.play = originalPlay
        if (audioPlayer) {
            audioPlayer.destroy()
            audioPlayer = null
        }
    })
    test('Test autoplay success', () => {
        window.HTMLMediaElement.prototype.play = () => {
            return new Promise((resolve, reject)=> {
                resolve()
            })
        };
        return expect(audioPlayer.play()).resolves.toBe(undefined);
    })
    test('Test autoplay prevented', () => {
        window.HTMLMediaElement.prototype.play = () => {
            return new Promise((resolve, reject)=> {
                reject()
            })
        };
        return expect(audioPlayer.play()).rejects.toMatch('Autoplay is prevented');
    })
})

afterAll(() => {
    window.AudioContext = originalAudioContext
    window.webkitAudioContext = originalWebkitAudioContext
})
