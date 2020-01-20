/**
 * @copyright: Copyright (C) 2019
 * @desc: decode methods in wasm
 * @author: liuliguo 
 * @file: PCWDecode.js
 */
import { AV_TIME_BASE_Q } from '../config/Config.js'

export default class PCWDecode {
  constructor(decode) {
    this.decode = decode
  }
  openDecode() {
    return _web_decoder_open()
  }
  closeDecode(p) {
    _web_decoder_close(p)
  }
  decodeData(pes, pts, p) {
    let fileSize = pes.length || 0
    Module.ccall(
      'web_decoder_decode_frame',
      'number',
      ['number', 'array', 'number', 'number'],
      [p, pes, fileSize, pts]
    )
  }
  flush(p) {
    let decode = this.decode
    if (_web_decoder_decode_frame) {
      while (true) {
        let ret = 0
        ret = _web_decoder_decode_frame(p, null, 0, 0)
        if (ret < 0 || !_web_got_frame(p)) {
          break
        } else {
          decode.getDecodeYUV(p)
        }
      }
    }
  }
  getYUV(p) {
    let stride_y = _web_get_stride_y(p)
    let stride_u = _web_get_stride_u(p)
    let stride_v = _web_get_stride_v(p)
    let width = _web_get_width(p)
    let height = _web_get_height(p)
    let addr_y = _web_get_frame_y(p)
    let addr_u = _web_get_frame_u(p)
    let addr_v = _web_get_frame_v(p)
    let pts = parseInt(_web_got_frame_pts(p) * AV_TIME_BASE_Q * 1000)

    let out_y = HEAPU8.subarray(addr_y, addr_y + stride_y * height)
    let out_u = HEAPU8.subarray(addr_u, addr_u + (stride_u * height) / 2)
    let out_v = HEAPU8.subarray(addr_v, addr_v + (stride_v * height) / 2)
    return {
      stride_y,
      stride_u,
      stride_v,
      width: width,
      height: height,
      buf_y: new Uint8Array(out_y),
      buf_u: new Uint8Array(out_u),
      buf_v: new Uint8Array(out_v),
      pts: pts
    }
  }
  checkData(p) {
    return _web_got_frame(p)
  }
}
