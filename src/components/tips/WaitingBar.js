/**
 * @copyright: Copyright (C) 2019
 * @file WaitingBar.js
 * @desc
 * WaitingBar
 * @see
 * @author Jarry
 */

import BaseComponent from '../../base/BaseComponent'
import { sizeFormat } from '../../utils/Format'
import Events from '../../config/EventsConfig'

/* spinner loading */
// template = this.createTemplate`
//   <gp-wait class="goldplay-tip goldplay__waiting-bar" title="${'title'}" data-display="${'display'}">
//   <svg width="80px"  height="80px"  xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" style="background: none;"><g transform="rotate(0 50 50)">
//   <rect x="47" y="24" rx="9.4" ry="4.8" width="6" height="12" fill="#f9f9f9">
//     <animate attributeName="opacity" values="1;0" keyTimes="0;1" dur="1s" begin="-0.9166666666666666s" repeatCount="indefinite"></animate>
//   </rect>
// </g><g transform="rotate(30 50 50)">
//   <rect x="47" y="24" rx="9.4" ry="4.8" width="6" height="12" fill="#f9f9f9">
//     <animate attributeName="opacity" values="1;0" keyTimes="0;1" dur="1s" begin="-0.8333333333333334s" repeatCount="indefinite"></animate>
//   </rect>
// </g><g transform="rotate(60 50 50)">
//   <rect x="47" y="24" rx="9.4" ry="4.8" width="6" height="12" fill="#f9f9f9">
//     <animate attributeName="opacity" values="1;0" keyTimes="0;1" dur="1s" begin="-0.75s" repeatCount="indefinite"></animate>
//   </rect>
// </g><g transform="rotate(90 50 50)">
//   <rect x="47" y="24" rx="9.4" ry="4.8" width="6" height="12" fill="#f9f9f9">
//     <animate attributeName="opacity" values="1;0" keyTimes="0;1" dur="1s" begin="-0.6666666666666666s" repeatCount="indefinite"></animate>
//   </rect>
// </g><g transform="rotate(120 50 50)">
//   <rect x="47" y="24" rx="9.4" ry="4.8" width="6" height="12" fill="#f9f9f9">
//     <animate attributeName="opacity" values="1;0" keyTimes="0;1" dur="1s" begin="-0.5833333333333334s" repeatCount="indefinite"></animate>
//   </rect>
// </g><g transform="rotate(150 50 50)">
//   <rect x="47" y="24" rx="9.4" ry="4.8" width="6" height="12" fill="#f9f9f9">
//     <animate attributeName="opacity" values="1;0" keyTimes="0;1" dur="1s" begin="-0.5s" repeatCount="indefinite"></animate>
//   </rect>
// </g><g transform="rotate(180 50 50)">
//   <rect x="47" y="24" rx="9.4" ry="4.8" width="6" height="12" fill="#f9f9f9">
//     <animate attributeName="opacity" values="1;0" keyTimes="0;1" dur="1s" begin="-0.4166666666666667s" repeatCount="indefinite"></animate>
//   </rect>
// </g><g transform="rotate(210 50 50)">
//   <rect x="47" y="24" rx="9.4" ry="4.8" width="6" height="12" fill="#f9f9f9">
//     <animate attributeName="opacity" values="1;0" keyTimes="0;1" dur="1s" begin="-0.3333333333333333s" repeatCount="indefinite"></animate>
//   </rect>
// </g><g transform="rotate(240 50 50)">
//   <rect x="47" y="24" rx="9.4" ry="4.8" width="6" height="12" fill="#f9f9f9">
//     <animate attributeName="opacity" values="1;0" keyTimes="0;1" dur="1s" begin="-0.25s" repeatCount="indefinite"></animate>
//   </rect>
// </g><g transform="rotate(270 50 50)">
//   <rect x="47" y="24" rx="9.4" ry="4.8" width="6" height="12" fill="#f9f9f9">
//     <animate attributeName="opacity" values="1;0" keyTimes="0;1" dur="1s" begin="-0.16666666666666666s" repeatCount="indefinite"></animate>
//   </rect>
// </g><g transform="rotate(300 50 50)">
//   <rect x="47" y="24" rx="9.4" ry="4.8" width="6" height="12" fill="#f9f9f9">
//     <animate attributeName="opacity" values="1;0" keyTimes="0;1" dur="1s" begin="-0.08333333333333333s" repeatCount="indefinite"></animate>
//   </rect>
// </g><g transform="rotate(330 50 50)">
//   <rect x="47" y="24" rx="9.4" ry="4.8" width="6" height="12" fill="#f9f9f9">
//     <animate attributeName="opacity" values="1;0" keyTimes="0;1" dur="1s" begin="0s" repeatCount="indefinite"></animate>
//   </rect>
// </g></svg>
//   </gp-wait>
//   `

/* rolling loading */
// template = this.createTemplate`
// <gp-wait class="goldplay-tip goldplay__waiting-bar" title="${'title'}" data-display="${'display'}">
// <svg width="50px"  height="50px"  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" style="background: none;"><circle cx="50" cy="50" fill="none" stroke="#f9f9f9" stroke-width="10" r="35" stroke-dasharray="164.93361431346415 56.97787143782138" transform="rotate(257.903 50 50)"><animateTransform attributeName="transform" type="rotate" calcMode="linear" values="0 50 50;360 50 50" keyTimes="0;1" dur="1s" begin="0s" repeatCount="indefinite"></animateTransform></circle></svg>
// </gp-wait>
// `

class WaitingBar extends BaseComponent {
  
  template = this.createTemplate`
  <gp-wait class="goldplay-tip goldplay__waiting-bar" title="${'title'}" data-status="${'status'}">
    <span class="goldplay__waiting-bar--icon">
    <svg width="60px" height="60px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" style="background: none;opacity:0.8">
    <circle cx="50" cy="50" fill="none" stroke-linecap="round" r="40" stroke-width="8" stroke="#f6f6f6" stroke-dasharray="62.83185307179586 62.83185307179586" transform="rotate(17.8841 50 50)">
    <animateTransform attributeName="transform" type="rotate" calcMode="linear" values="0 50 50;360 50 50" keyTimes="0;1" dur="0.7s" begin="0s" repeatCount="indefinite">
    </animateTransform>
    </circle>
    </svg>
  </span>
  <gp-speed class="goldplay__waiting-bar--speed">${'speed'}</gp-speed>
  </gp-wait>
  `
  data = {
    title: 'waiting',
    speed: '',
    status: '',
    display: 'show',
  }
  options = {}
  constructor(options = {}) {
    super(options)
    this.options = options
    Object.assign(this.data, options.data)
    this.init()
  }

  initProps() {
    
  }

  bindEvent() {
    this.events.on(Events.LoaderUpdateSpeed, data => {
      if (this.data.display === 'show') {
        this.data.speed = sizeFormat.formatBytes(data.speed) + ' /s'
      }
    })
  }

  showWaiting() {
    const cssName = this.options.cssName
    const $box = this.options.$screenContainer
    if (!$box.querySelector('.' + cssName.waitingBar)) {
      $box.prepend(this.element)
    }
    this.data.display = 'show'
    this.show()
    this.resetPosition()
  }

  hideWaiting() {
    const cssName = this.options.cssName
    const $box = this.options.$screenContainer
    if ($box.querySelector('.' + cssName.waitingBar)) {
      this.data.display = 'hide'
      this.data.speed = 'Loading...'
      this.hide()
    }
  }
}

export default WaitingBar