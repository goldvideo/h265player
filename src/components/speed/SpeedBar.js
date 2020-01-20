/**
 * @copyright: Copyright (C) 2019
 * @desc: SpeedBar
 * @author: Jarry
 * @file: SpeedBar.js
 */

import BaseComponent from '../../base/BaseComponent'
import { Config } from '../../config/Config'
import delegator from '../../toolkit/Delegator'
import Events from '../../config/EventsConfig'
const makeSpeedListHTML = data => {
  if (!data) {
    return
  }
  let html = ['<ul>']
  for (let item of data) {
    let selectedClass = ''
    let selectedHTML = ''
    if (item.selected) {
      selectedClass = 'gp-selected'
      selectedHTML = ` selected=${item.selected}`
    }
    html.push(`
    <li class="${selectedClass}" gp-node-li value="${item.value}" ${selectedHTML}>${item.name}</li>
    `)
  }
  html.push('</ul>')
  return html.join('')
}
class SpeedBar extends BaseComponent {
  template = this.createTemplate`
  <gp-speed class="goldplay__speed-bar" title="${'title'}">
  <gp-overbox class="goldplay-hoverbox goldplay__speed-bar--box">
  ${'speedListHTML|html'}
  </gp-overbox>
  <gp-button class="goldplay__speed-bar--link">
  ${'currentSpeedName'}
  </gp-button>
  </gp-speed>
  `
  data = {
    title: 'speed',
    currentSpeed: 1.0,
    speedList: null,
    currentSpeedName: '倍速',
    speedListHTML: ''
  }
  options = {}
  constructor(options = {}) {
    super(options)
    this.options = options
    this.speedList = this.options.player.options.speedList || Config.speedList
    this.updateSpeedListHTML()
    Object.assign(this.data, options.data)
    this.init()
    this.initProps()
    this.showHideBar()
  }

  initProps() {
    const cssName = this.options.cssName
    this.$barBox = this.element.querySelector('.' + cssName.speedBarBox)
  }

  bindEvent() {
    const cssName = this.options.cssName
    const $container = this.options.$controlBarContainer
    delegator($container).on('mouseover', '.' + cssName.speedBar, () => {
      clearTimeout(boxHidetimer)
      this.showBarBoxHandle()
    })

    const _inBoxScope = (evt) => {
      const $bar = this.element
      const scope = {
        y: this.$barBox.offsetTop,
        x: $bar.offsetLeft
      }
      scope.width = $bar.offsetWidth
      scope.height = this.$barBox.offsetHeight
      if (evt.pageX > scope.x && evt.pageX < (scope.x + scope.width)
      && evt.pageY > scope.y && evt.pageY < (scope.y + scope.height)
      ) {
        return true
      } else {
        return false
      }
    }
    let boxHidetimer
    delegator($container).on('mouseout', '.' + cssName.speedBar, (evt) => {
      boxHidetimer = setTimeout( () => {
      if (!_inBoxScope(evt)) {
          this.hideBarBoxHandle()
        } else {
          clearTimeout(boxHidetimer)
        }
      }, Config.hideBarBoxTime)
    })

    delegator(this.element).on('click', '[gp-node-li]', evt => {
      const ele = evt.target
      const value = parseFloat(ele.getAttribute('value'), 10)
      if (value === this.data.currentSpeed) {
        return
      }
      this.data.currentSpeed = value
      const selected = this.speedList.filter(item => item.value === value)
      this.events.emit(Events.PlayerSpeedTo, selected[0])
      this.updateSpeedListHTML()
    })

  }

  showHideBar() {
    const speedList = this.speedList
    if (speedList.length <= 0) {
      this.hide()
      return
    }
  }

  resetBoxPosition() {
    const marginTop = 33 + this.speedList.length * 28
    const marginLeft = (this.$barBox.offsetWidth - this.element.offsetWidth) / 2
    this.$barBox.style.marginTop = -marginTop + 'px'
    this.$barBox.style.marginLeft = -marginLeft + 'px'
  }

  hideBarBoxHandle() {
    this.$barBox.style.visibility = 'hidden'
  }

  showBarBoxHandle() {
    this.$barBox.style.visibility = 'visible'
  }

  updateSpeedListHTML(speedValue) {
    const speedList = this.speedList
    if (speedList.length <= 0) {
      return
    }
    if (speedValue === undefined) {
      speedValue = this.data.currentSpeed
    }
    const list = speedList.slice(0, speedList.length).reverse()
    for (let item of list) {
      if (item.value === speedValue) {
        item.selected = true
      } else {
        delete item.selected
      }
    }
    return this.data.speedListHTML = makeSpeedListHTML(list)
  }
}

export default SpeedBar