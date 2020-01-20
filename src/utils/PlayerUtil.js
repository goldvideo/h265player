/**
 * Copyright (C) 2019.
 * All Rights Reserved.
 * @file PlayerUtil.js
 * @desc
 * common utils function from Player
 * @author Jarry
 */
import Element from '../toolkit/Element.js'
import { CSSConfig } from '../config/CSSConfig'

const cssName = CSSConfig
export default class PlayerUtil {

  static createContainer(player) {
    class ContainerElement extends HTMLDivElement {}
    const tagName = 'gp-container'
    if (!customElements.get(tagName)) {
      customElements.define(tagName, ContainerElement, { extends: 'div' })
    }
    const $ele = Element.createEl(tagName, 'div')
    $ele.className = cssName.playerContainer
    $ele.style.width = (player.options.width ? player.options.width : player.el.offsetWidth) + 'px'
    $ele.style.height = (player.options.height  ? player.options.height : player.el.offsetHeight) + 'px'
    return $ele
  }

  static createScreenContainer(player) {
    const $container = player.$container
    class ScreenElement extends HTMLDivElement {}
    const tagName = 'gp-screen'
    if (!customElements.get(tagName)) {
      customElements.define(tagName, ScreenElement, { extends: 'div' })
    }
    const $ele = Element.createEl(tagName, 'div')
    $ele.classList.add(cssName.screenContainer)
    let screenHeight
    if (player.controlBarAutoHide) {
      screenHeight = $container.offsetHeight
    } else {
      screenHeight = $container.offsetHeight - player.controlBarHeight
    }
    $ele.style.height = screenHeight + 'px'
    return $ele
  }
  static createCanvas = (player) => {
    const $ele = Element.createEl('canvas')
    $ele.style.display = 'none'
    $ele.classList.add(cssName.screenCanvas)
    $ele.width = player.options.screenWidth || player.screenWidth
    $ele.height = player.options.screenHeight || player.screenHeight
    return $ele
  }

  static createAudioContainer() {
    const $ele = Element.createEl('gp-audio')
    $ele.classList.add(cssName.audioContainer)
    $ele.style.display = 'none'
    return $ele
  }

  static createAudio() {
    const $ele = Element.createEl('audio')
    $ele.classList.add(cssName.audioPlayer)
    $ele.controls = true
    return $ele
  }

  static clearCavans($canvas) {
    const context = $canvas.getContext('webgl')
    context.clear(context.COLOR_BUFFER_BIT)
  }

}
