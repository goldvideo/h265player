import AudioContextPlayer from '../src/audio/AudioContextPlayer'
import 'web-audio-test-api'
import fs from 'fs'
import path from 'path'

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
        //config Web Audio API mock
        WebAudioTestAPI.setState({
            "AudioContext#decodeAudioData": "promise",
        });
        const aacPath = path.resolve(__dirname, 'Forrest_Gump_IMAX.aac');
        const buffer = fs.readFileSync(aacPath);
        audioPlayer.feed({
            audio: buffer
        })
        expect(audioPlayer.audioBuffer.byteLength).toBe(buffer.length)
    });
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