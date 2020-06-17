/**
 * @copyright: Copyright (C) 2019
 * @desc: PauseButton
 * @author: Jarry
 * @file: PauseButton.js
 */

import BaseComponent from '../../base/BaseComponent'
import Template from '../../toolkit/Template'

// template = this.createTemplate`
// <gp-button class="goldplay__control--pause" title="${'title'}">
// <svg id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
// width="20px" height="20px" viewBox="0 0 535.578 535.578" style="enable-background:new 0 0 535.578 535.578;" xml:space="preserve">
// <g>
// <path d="M231.6,516.278c0,10.658-8.641,19.3-19.3,19.3H106.15c-10.659,0-19.3-8.641-19.3-19.3V19.3
//   c0-10.659,8.641-19.3,19.3-19.3h106.15c10.659,0,19.3,8.641,19.3,19.3V516.278z" fill="#f1f1f1"/>
// <path d="M468.728,516.278c0,10.658-8.641,19.3-19.3,19.3h-106.15c-10.659,0-19.3-8.641-19.3-19.3V19.3
//   c0-10.659,8.641-19.3,19.3-19.3h106.15c10.659,0,19.3,8.641,19.3,19.3V516.278z" fill="#f1f1f1"/>
// </g>
// </svg>
// </gp-button>`

const PAUSE_ICON = Template.create`
<svg style="display:${'pauseHide'}" class="goldplay__control--pausing" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="20px" height="20px" viewBox="0 0 26 26" style="background:none" xml:space="preserve">
<g>
<path d="M2.667,0h6v26h-6V0z M15.333,0v26h6V0H15.333z" fill="#f1f1f1"/>
</g>
</svg>
`

const PAUSE_LOADING_ICON = `
<svg version="1.1" class="goldplay__control--pause-loading" style="display:\${'pauseLoadingHide'}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="25px" height="25px" viewBox="0 0 612 792" style="background:none;margin: -4px 0 0 -5px;" xml:space="preserve">
<linearGradient id="goldplay-pause-loading-gradient" gradientUnits="userSpaceOnUse" x1="1.98" y1="784.6123" x2="26.2101" y2="770.623" gradientTransform="matrix(21.8571 0 0 21.8571 -2.0895 -16600.5293)">
    <stop offset="0.1682" style="stop-color:#f1f1f1;stop-opacity:0"></stop>
    <stop offset="0.7502" style="stop-color:#f1f1f1"></stop>
    <stop offset="1" style="stop-color:#f1f1f1"></stop>
</linearGradient>
<path style="transform-origin: center center;animation: goldplay-rotate-360 .8s linear infinite;" fill="url(#goldplay-pause-loading-gradient)" d="M306,133.714c144.257,0,262.286,118.028,262.286,262.286c0,144.257-118.029,262.286-262.286,262.286
  C161.743,658.286,43.714,540.257,43.714,396C43.714,251.743,161.743,133.714,306,133.714 M306,90C137.7,90,0,227.7,0,396
  s137.7,306,306,306s306-137.7,306-306S474.3,90,306,90L306,90z">
    <animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0" to="360" dur=".8s" repeatCount="indefinite" />
</path>
<g>
    <g>
        <path fill="#f1f1f1" d="M229.5,514.028L229.5,514.028c-13.114,0-21.857-8.742-21.857-21.856V295.457
        c0-10.929,8.743-21.857,21.857-21.857l0,0c10.929,0,21.857,8.743,21.857,21.857v196.715
        C251.357,503.1,242.614,514.028,229.5,514.028z"></path>
        <path fill="#f1f1f1" d="M229.5,273.6c-13.114,0-21.857,8.743-21.857,21.857v196.715c0,10.928,8.743,21.856,21.857,21.856
        s21.857-10.929,21.857-21.856V295.457C251.357,282.343,242.614,273.6,229.5,273.6L229.5,273.6z"></path>
    </g>
    <g>
        <path fill="#f1f1f1" d="M382.5,518.4L382.5,518.4c-13.114,0-21.857-8.743-21.857-21.857V299.829
        c0-10.929,8.743-21.857,21.857-21.857l0,0c10.929,0,21.857,8.743,21.857,21.857v196.714
        C404.357,509.657,395.614,518.4,382.5,518.4z"></path>
        <path fill="#f1f1f1" d="M382.5,277.972c-10.929,0-21.857,8.743-21.857,21.857v196.714c0,10.929,10.929,21.857,21.857,21.857
        s21.857-10.929,21.857-21.857V299.829C404.357,288.9,393.429,277.972,382.5,277.972L382.5,277.972z"></path>
    </g>
</g>
</svg>
`
class PauseButton extends BaseComponent {
  template = this.createTemplate((data, create) => create`
  <gp-button class="goldplay__control--pause" title="${'title'}" status="${'status'}">
  ${'icon|html'}
  </gp-button>
  `)
  /* all button pre-reserved in DOM */
  // template = this.createTemplate`
  // <gp-button class="goldplay__control--pause" title="${'title'}" status="${'status'}">
  // <svg style="display:${'pauseHide'}" class="goldplay__control--pausing" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="20px" height="20px" viewBox="0 0 26 26" style="background:none" xml:space="preserve">
  // <g>
  // <path d="M2.667,0h6v26h-6V0z M15.333,0v26h6V0H15.333z" fill="#f1f1f1"/>
  // </g>
  // </svg>
  // <svg version="1.1" class="goldplay__control--pause-loading" style="display:${'pauseLoadingHide'}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="30px" height="30px" viewBox="0 0 612 792" style="background:none;margin: -4px 0 0 -5px;" xml:space="preserve">
  //     <linearGradient id="goldplay-pause-loading-gradient" gradientUnits="userSpaceOnUse" x1="1.98" y1="784.6123" x2="26.2101" y2="770.623" gradientTransform="matrix(21.8571 0 0 21.8571 -2.0895 -16600.5293)">
  //         <stop offset="0.1682" style="stop-color:#f1f1f1;stop-opacity:0"></stop>
  //         <stop offset="0.7502" style="stop-color:#f1f1f1"></stop>
  //         <stop offset="1" style="stop-color:#f1f1f1"></stop>
  //     </linearGradient>
  //     <path style="transform-origin: center center;" fill="url(#goldplay-pause-loading-gradient)" d="M306,133.714c144.257,0,262.286,118.028,262.286,262.286c0,144.257-118.029,262.286-262.286,262.286
  //       C161.743,658.286,43.714,540.257,43.714,396C43.714,251.743,161.743,133.714,306,133.714 M306,90C137.7,90,0,227.7,0,396
  //       s137.7,306,306,306s306-137.7,306-306S474.3,90,306,90L306,90z">
  //         <animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0" to="360" dur=".8s" repeatCount="indefinite" />
  //     </path>
  //     <g>
  //         <g>
  //             <path fill="#f1f1f1" d="M229.5,514.028L229.5,514.028c-13.114,0-21.857-8.742-21.857-21.856V295.457
  //             c0-10.929,8.743-21.857,21.857-21.857l0,0c10.929,0,21.857,8.743,21.857,21.857v196.715
  //             C251.357,503.1,242.614,514.028,229.5,514.028z"></path>
  //             <path fill="#f1f1f1" d="M229.5,273.6c-13.114,0-21.857,8.743-21.857,21.857v196.715c0,10.928,8.743,21.856,21.857,21.856
  //             s21.857-10.929,21.857-21.856V295.457C251.357,282.343,242.614,273.6,229.5,273.6L229.5,273.6z"></path>
  //         </g>
  //         <g>
  //             <path fill="#f1f1f1" d="M382.5,518.4L382.5,518.4c-13.114,0-21.857-8.743-21.857-21.857V299.829
  //             c0-10.929,8.743-21.857,21.857-21.857l0,0c10.929,0,21.857,8.743,21.857,21.857v196.714
  //             C404.357,509.657,395.614,518.4,382.5,518.4z"></path>
  //             <path fill="#f1f1f1" d="M382.5,277.972c-10.929,0-21.857,8.743-21.857,21.857v196.714c0,10.929,10.929,21.857,21.857,21.857
  //             s21.857-10.929,21.857-21.857V299.829C404.357,288.9,393.429,277.972,382.5,277.972L382.5,277.972z"></path>
  //         </g>
  //     </g>
  // </svg>
  // </gp-button>
  // `

  data = {
    title: 'pause',
    pauseHide: '',
    pauseLoadingHide: 'none',
    icon: PAUSE_ICON,
    // pause | pauseloading | ''
    status: '',
    display: ''
  }
  options = {}
  watch() {
    if (this.data.status === 'pauseloading') {
      this.data.pauseHide = 'none'
      this.data.pauseLoadingHide = 'inline-block'
      this.data.title = 'loading'
      this.data.icon = PAUSE_LOADING_ICON
    } else if (this.data.status === 'pause') {
      this.data.pauseHide = 'inline-block'
      this.data.pauseLoadingHide = 'none'
      this.data.title = 'pause'
      this.data.icon = PAUSE_ICON
    }
  }
  constructor(options = {}) {
    super(options)
    this.options = options
    Object.assign(this.data, options.data)
    this.init()
  }

}

export default PauseButton