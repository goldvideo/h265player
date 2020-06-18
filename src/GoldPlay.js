/**
 * @copyright: Copyright (C) 2019
 * @desc: 
 * @author: liuliguo 
 * @file: GolePlay.js
 */

import Player from './Player'
import { CONPONENTS_MAP } from './config/ComponentConfig'
import BaseComponent from './base/BaseComponent'
import ComponentsController from './components/ComponentsController'
import SideControlBar from './control-bar/SideControlBar'
import NearControlBar from './control-bar/NearControlBar'

class GoldPlay extends Player {
  // poster = ''
  // startTime = 1000
  // controlBarAutoHide = true
  // controlBarAutoHideTime = 1
  libPath = null
  /**
   * GoldPlay is the class exposed to user and inherited from Player
   * @constructs
   * @param {Elemnent} el - The container of rendering player
   * @param {Object} options - The setting of the player
   */
  constructor(el, options) {
    super(el, options)
    this.options.processURL = options.processURL
    this.libPath = options.libPath
    if (this.options.needInit !== false) {
      this.init()
    }
  }

  /**
   * @method
   * @name getComponent
   * @param {String} name - component name
   * @description get the component registered in components map
   */
  static getComponent(name) {
    return CONPONENTS_MAP[name]
  }
  /**
   * @method
   * @name registerComponent
   * @param {String} name - component name
   * @param {Class} componentToAdd - The component class defined by user
   * @param {String} [pos=right] - Which side of control bar
   * @param {number} [index=-1] - Display index, last by default
   * @description register the new component to components map and it will be instantiated and rendered when player is inited
   */
  static registerComponent(name, componentToAdd, pos = 'right', index = -1) {
    if (typeof name !== 'string' || !name) {
      throw new Error(
        `Illegal component name, "${name}"; must be a non-empty string.`
      )
    }

    const isComp = Object.prototype.isPrototypeOf.call(BaseComponent, componentToAdd.prototype)

    if (!isComp) {
      throw new Error(
        `Illegal component, "${name}"; must be a BaseComponent subclass.`
      )
    }
    CONPONENTS_MAP[name] = componentToAdd
    ComponentsController.addComponet(name)
    if(pos === 'left') {
      NearControlBar.addCustomControl(name, index)
    } else {
      SideControlBar.addCustomControl(name, index)
    }
  }

}

export default GoldPlay
