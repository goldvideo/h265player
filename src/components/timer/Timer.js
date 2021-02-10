/**
 * @copyright: Copyright (C) 2019
 * @desc: Timer
 * @author: Jarry
 * @file: Timer.js
 */

import BaseComponent from '../../base/BaseComponent'
import { timeFormat } from '../../utils/Format'
import Events from '../../config/EventsConfig'

class Timer extends BaseComponent {
  template = this.createTemplate`
  <gp-time class="goldplay__control--timer">
  <span gid="time" class="goldplay__control--timer-play">${'time'}</span>
  <span gid="slash">${'slash'}</span>
  <span gid="total-time" class="goldplay__control--timer-total">${'totalTime'}</span>
  </gp-time>
  `
  data = {
    time: '00:00',
    totalTime: '',
    slash: '/'
  }
  options = {}
  constructor(options = {}) {
    super(options)
    this.options = options
    Object.assign(this.data, options.data)
    this.init()
  }

  setTotalTime(data) {
    const source = data.sourceData
    this.data.totalTime = timeFormat.formatHHMMSS(source.duration)
  }

  bindEvent() {
    this.events.on(Events.LoaderPlayListLoaded, loader => {
      this.setTotalTime(loader.dataManage)
    })
  }

  updateTime(second) {
    this.element.querySelector('[gid="time"]').innerHTML = second
  }

  updateTotalTime(second) {
    this.element.querySelector('[gid="total-time"]').innerHTML = second
  }

}

export default Timer