/**
 * @copyright: Copyright (C) 2019
 * @file ComponentsController.js
 * @desc
 * components controller
 * @see
 * @author Jarry
 */

import BaseController from '../base/BaseController.js'
import { CSSConfig } from '../config/CSSConfig'
import { CONPONENTS_MAP } from '../config/ComponentConfig'
import Events from '../config/EventsConfig'
const cssName = CSSConfig

const covertFirstUpperCase = str => {
  let first = str.substr(0, 1)
  return first.toUpperCase() + str.substr(1)
}

class ComponentsController extends BaseController {
  allComponents = {}
  controlBarController = null
  options = {
    cssName: cssName
  }
  constructor(options = {}) {
    super(options)
    this.options = Object.assign(this.options, options)
    this.options.componentsController = this
    this.initComponents()
    ;(this.$container = this.options.$container),
      (this.$screenContainer = this.options.$screenContainer),
      (this.$canvas = this.options.$canvas),
      (this.$audioContainer = this.options.$audioContainer),
      (this.$audio = this.options.$audio),
      (this.options.$controlBarContainer = this.controlBarContainer.element)
    this.bindEvent()
  }

  run() {
    const that = this
    this.controlBarController.run()
    // add to register new component method
    for (let key in CONPONENTS_MAP) {
      if (that[key] && typeof that[key].registerMethod === 'function') {
        that[key].registerMethod()
      }
    }
  }

  initComponents() {
    for (let componentName in CONPONENTS_MAP) {
      let Clazz = CONPONENTS_MAP[componentName]
      if (!this.allComponents[componentName]) {
        this.createComponent(Clazz, componentName)
      }
    }
  }

  bindEvent() {
    this.events.on(Events.PlayerLoadedMetaData, () => {
      this.poster.hide()
    })
    this.events.on(Events.AudioPlayerPlayFail, () => {
      this.drawBigPlayButton()
      this.getComponent('poster').hide()
      this.events.emit(Events.PlayerOnPause, this)
      this.events.emit(Events.ControlBarPause, this)
    })
    this.bindAlertBoxEvent()
    this.bindWaitingBarEvent()
  }

  bindWaitingBarEvent() {
    this.waitingBar.initProps()
    this.waitingBar.bindEvent()
  }

  drawBigPlayButton() {
    this.$screenContainer.prepend(this.bigPlayButton.element)
    this.bigPlayButton.show()
    this.bigPlayButton.bindEvent()
    this.bigPlayButton.resetPosition()
  }

  setControlBarController(controller) {
    this.controlBarController = controller
  }

  getControlBarController() {
    return this.controlBarController || this.options.player.controlBarContainer
  }

  bindAlertBoxEvent() {
    this.alertBox.initProps()
    this.alertBox.bindEvent()
  }

  drawPoster() {
    this.$screenContainer.prepend(this.poster.element)
    this.poster.data.display = 'show'
    this.poster.bindEvent()
    this.poster.resetPosition()
  }

  createComponent(Clazz, componentName) {
    const upperCaseName = covertFirstUpperCase(componentName)
    this['set' + upperCaseName](new Clazz(this.options))
    this[componentName] = this['get' + upperCaseName]()
    if (!this.allComponents[componentName]) {
      this.allComponents[componentName] = this[componentName]
    }
  }

  getComponent(name) {
    if (!this.allComponents[name]) {
      if (CONPONENTS_MAP[name]) {
        this.createComponent(CONPONENTS_MAP[name], name)
      }
    }
    return this.allComponents[name]
  }

  resetAllComponents() {
    const keys = Object.getOwnPropertyNames(this)
    const result = {}
    keys.forEach(key => {
      if (CONPONENTS_MAP[key]) {
        result[key] = this[key]
      }
    })
    this.allComponents = result
  }

  getAllComponents() {
    return this.allComponents
  }
}

ComponentsController.addComponet = function(componentName) {
  const upperCaseName = covertFirstUpperCase(componentName)
  ComponentsController.prototype['set' + upperCaseName] = function(component) {
    this[componentName] = component
  }
  ComponentsController.prototype['get' + upperCaseName] = function() {
    return this[componentName]
  }
}

for (let componentName in CONPONENTS_MAP) {
  ComponentsController.addComponet(componentName)
}

export default ComponentsController
