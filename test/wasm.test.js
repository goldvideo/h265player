/**
 * @jest-environment node
 */
import Module from "../dist/lib/libffmpeg"
import fs from 'fs'
import path from 'path'

test('Check openDecoder', () => {
    expect(Module._openDecoder instanceof Function).toBe(true)
    expect(Module._openDecoder(0, 0)).toBe(0)
})

test('Check decode and flush', () => {
    // check api
    expect(Module._decodeData instanceof Function).toBe(true)
    expect(Module._flushDecoder instanceof Function).toBe(true)
    // decode h.265 data
    const mockCallback = jest.fn();
    var videoCallback = Module.addFunction(mockCallback)
    Module._openDecoder(videoCallback, 0)
    const videoPath = path.resolve(__dirname, 'FourPeople_1280x720_60_1M.265');
    const buffer = fs.readFileSync(videoPath);
    var typedArray = new Uint8Array(buffer);
    var size = typedArray.length
    var cacheBuffer = Module._malloc(size);
    Module.HEAPU8.set(typedArray, cacheBuffer);
    Module._decodeData(cacheBuffer, size)
    Module._flushDecoder()
    // check frame count
    expect(mockCallback.mock.calls.length).toBe(719);
    // check width and height
    expect(mockCallback.mock.calls[0][6]).toBe(1280)
    expect(mockCallback.mock.calls[0][7]).toBe(720)
})

test('Check closeDecoder', () => {
    expect(Module._closeDecoder instanceof Function).toBe(true)
    expect(Module._closeDecoder()).toBe(0)
})
