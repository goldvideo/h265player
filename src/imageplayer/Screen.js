/**
 * @copyright: Copyright (C) 2019
 * @desc: render yuv on canvas
 * @author: liuliguo 
 * @file: Screen.js
 */
import yuvCanvas from 'yuv-canvas'
import yuvBuffer from 'yuv-buffer'
import BaseClass from '../base/BaseClass'

export default class Screen extends BaseClass {
  canvas = null
  render = null

  constructor(options) {
    super()
    this.setCanvas(options.canvas)
    this.setRender()
  }

  setCanvas(canvas) {
    this.canvas = canvas
  }

  // 禁用 WebGL，解决坐标翻转和绿幕问题
  setRender(canvasElem) {
    this.render = yuvCanvas.attach(canvasElem || this.canvas, { webGL: false })
  }

  clear() {
    if (this.render && this.render.clear) {
      this.render.clear()
    }
  }

  // 可选：释放资源
  destroy() {
    if (this.render && this.render.destroy) {
      this.render.destroy()
    }
    this.render = null
  }

  drawFrame(data) {
    const st = Date.now()

    // 数据校验
    if (!data || !data.buf_y || !data.buf_u || !data.buf_v || !data.width || !data.height) {
      this.logger.warn('drawFrame', 'Invalid frame data', data)
      return
    }

    let { buf_y, buf_u, buf_v, width, height, stride_y, stride_u, stride_v } = data

    // 宽高取整（避免奇数宽度导致小数）
    const width_y = width
    const height_y = height
    const width_u = Math.floor(width_y / 2)
    const height_u = Math.floor(height_y / 2)

    const y = { bytes: buf_y, stride: stride_y }
    const u = { bytes: buf_u, stride: stride_u }
    const v = { bytes: buf_v, stride: stride_v }

    const format = yuvBuffer.format({
      width: width_y,
      height: height_y,
      chromaWidth: width_u,
      chromaHeight: height_u
    })

    const frameDisplay = yuvBuffer.frame(format, y, u, v)
    this.render.drawFrame(frameDisplay)

    const endt = Date.now()
    if (endt - st > 16) {
      this.logger.warn('drawFrame', 'render time:', endt - st, 'ms')
    }
  }
}