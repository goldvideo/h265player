/**
 * @copyright: Copyright (C) 2019
 * @desc: RateBar
 * @author: Jarry
 * @file: RateBar.js
 */

import BaseComponent from '../../base/BaseComponent'
import { Config } from '../../config/Config'
import delegator from '../../toolkit/Delegator'
import Events from '../../config/EventsConfig'
const makeRateListHTML = data => {
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
class RateBar extends BaseComponent {
  rateList = []
  defaultRate = { value: '600', name: '高清' }
  template = this.createTemplate`
  <gp-rate class="goldplay__rate-bar" title="${'title'}">
  <gp-overbox class="goldplay-hoverbox goldplay__rate-bar--box">
  ${'rateListHTML|html'}
  </gp-overbox>
  <gp-button class="goldplay__rate-bar--link">
  ${'currentRateName'}
  </gp-button>
  </gp-rate>
  `
  data = {
    title: 'stream rate',
    currentRate: '600',
    currentRateName: '高清',
    rateListHTML: ''
  }
  options = {}
  constructor(options = {}) {
    super(options)
    this.options = options
    Object.assign(this.data, options.data)
    this.rateList = this.options.player.options.rateList || this.rateList
    this.defaultRate = this.options.player.options.defaultRate || this.defaultRate
    this.setDefaultRate()
    this.updateRateListHTML()
    this.init()
    this.initProps()
    this.showHideBar()
  }

  initProps() {
    const cssName = this.options.cssName
    this.$barBox = this.element.querySelector('.' + cssName.rateBarBox)
  }

  setDefaultRate() {
    if (this.rateList.length <= 0) {
      return
    }
    const currentRate = this.rateList.find(item => {
      return String(item.value) === String(this.defaultRate.value)
    })
    if (currentRate) {
      this.data.currentRateName = currentRate.name
      this.data.currentRate = currentRate.value
    } else {
      this.data.currentRateName = this.rateList[0].name
      this.data.currentRate = this.rateList[0].value
    }
  }

  bindEvent() {
    const cssName = this.options.cssName
    const $container = this.options.$controlBarContainer
    delegator($container).on('mouseover', '.' + cssName.rateBar, () => {
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
    delegator($container).on('mouseout', '.' + cssName.rateBar, (evt) => {
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
      const value = ele.getAttribute('value')
      if (value === this.data.currentRate) {
        return
      }
      this.data.currentRate = value
      const selected = this.rateList.filter(item => item.value === value)
      this.events.emit(Events.PlayerChangeRate, selected[0])
      this.data.currentRateName = selected[0].name
      this.updateRateListHTML()
      this.hideBarBoxHandle()
    })

  }

  showHideBar() {
    const rateList = this.rateList
    if (rateList && rateList.length <= 0) {
      this.hide()
      return
    }
  }

  resetBoxPosition() {
    const marginTop = 33 + this.rateList.length * 28
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

  updateRateListHTML(rateValue) {
    const rateList = this.rateList
    if (rateList.length <= 0) {
      return
    }
    if (rateValue === undefined) {
      rateValue = this.data.currentRate
    }
    const list = rateList.slice(0, rateList.length).reverse()
    for (let item of list) {
      if (item.value === rateValue) {
        item.selected = true
      } else {
        delete item.selected
      }
    }
    return this.data.rateListHTML = makeRateListHTML(list)
  }
}

export default RateBar