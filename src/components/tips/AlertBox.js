/**
 * @copyright: Copyright (C) 2019
 * @desc: AlertBox.js
 * @author: Jarry
 * @file: AlertBox
 */

import delegator from '../../toolkit/Delegator.js'
import BaseComponent from '../../base/BaseComponent'

class AlertBox extends BaseComponent {
  
  template = this.createTemplate`
  <gp-alert class="goldplay-tip goldplay__alter-box" title="${'title'}" data-display="${'display'}">
  <em title="close" class="goldplay__alter--close">
    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="background:none;opacity:0.6" xml:space="preserve" width="20px" height="20px" viewBox="0 0 496.158 496.158">
    <path style="fill:#ff3300;" d="M496.158,248.085c0-137.021-111.07-248.082-248.076-248.082C111.07,0.003,0,111.063,0,248.085
    c0,137.002,111.07,248.07,248.082,248.07C385.088,496.155,496.158,385.087,496.158,248.085z"/>
    <path style="fill:#FFFFFF;" d="M277.042,248.082l72.528-84.196c7.91-9.182,6.876-23.041-2.31-30.951
    c-9.172-7.904-23.032-6.876-30.947,2.306l-68.236,79.212l-68.229-79.212c-7.91-9.188-21.771-10.216-30.954-2.306
    c-9.186,7.91-10.214,21.77-2.304,30.951l72.522,84.196l-72.522,84.192c-7.91,9.182-6.882,23.041,2.304,30.951
    c4.143,3.569,9.241,5.318,14.316,5.318c6.161,0,12.294-2.586,16.638-7.624l68.229-79.212l68.236,79.212
    c4.338,5.041,10.47,7.624,16.637,7.624c5.069,0,10.168-1.749,14.311-5.318c9.186-7.91,10.22-21.77,2.31-30.951L277.042,248.082z"/>
    </svg>
  </em>
  <span class="goldplay__alter--warn">
    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
    width="30" height="30" viewBox="0 0 512 512" style="enable-background:new 0 0 512 512;" xml:space="preserve">
    <path style="fill:#495A79;" d="M501.461,383.799L320.501,51.401C306.7,28.6,282.7,14.8,256,14.8s-50.7,13.8-64.501,36.601
      L10.539,383.799C-3.259,407.501-3.56,435.701,9.941,459.4c13.499,23.699,37.798,37.8,65.099,37.8h361.92
      c27.301,0,51.601-14.101,65.099-37.8C515.56,435.701,515.259,407.501,501.461,383.799z"/>
    <path style="fill:#42516D;" d="M502.059,459.4c-13.499,23.699-37.798,37.8-65.099,37.8H256V14.8c26.7,0,50.7,13.801,64.501,36.601
      L501.461,383.8C515.259,407.501,515.56,435.701,502.059,459.4z"/>
    <path style="fill:#FFDE33;" d="M475.661,399.1L294.699,66.699C286.601,52.9,271.901,44.8,256,44.8s-30.601,8.101-38.699,21.899
      L36.339,399.1c-8.399,14.101-8.399,31.199-0.298,45.3c8.099,14.399,22.798,22.8,39,22.8h361.92c16.201,0,30.901-8.401,39-22.8
      C484.06,430.299,484.06,413.201,475.661,399.1z"/>
    <path style="fill:#FFBC33;" d="M475.96,444.4c-8.099,14.399-22.798,22.8-39,22.8H256V44.8c15.901,0,30.601,8.101,38.699,21.899
      L475.661,399.1C484.06,413.201,484.06,430.299,475.96,444.4z"/>
    <g>
      <path style="fill:#495A79;" d="M256,437.2c-16.538,0-30-13.462-30-30s13.462-30,30-30s30,13.462,30,30S272.538,437.2,256,437.2z"/>
      <path style="fill:#495A79;" d="M286,317.2c0,16.538-13.462,30-30,30s-30-13.462-30-30v-150c0-16.538,13.462-30,30-30
        s30,13.462,30,30V317.2z"/>
    </g>
    <g>
      <path style="fill:#42516D;" d="M286,407.2c0-16.538-13.462-30-30-30v60C272.538,437.2,286,423.738,286,407.2z"/>
      <path style="fill:#42516D;" d="M286,317.2v-150c0-16.538-13.462-30-30-30v210C272.538,347.2,286,333.738,286,317.2z"/>
    </g>
    </svg>
  </span>
  <gp-content class="goldplay__alter--content">${'content|trim'}</gp-content>
  </gp-alert>
  `
  data = {
    title: 'alert',
    display: 'default',
    content: ``
  }
  options = {}
  constructor(options = {}) {
    super(options)
    this.options = options
    Object.assign(this.data, options.data)
    this.init()
  }

  bindEvent() {
    const $container = this.options.$screenContainer
    const cssName = this.options.cssName
    delegator($container).on('click', '.' + cssName.alertClose, () => {
      this.hide()
    })
  }

  afterWatch() {
    if (this.data.display === 'show') {
      this.resetPosition()
    }
  }

  showBox() {
    const cssName = this.options.cssName
    const $box = this.options.$screenContainer
    if (!$box.querySelector('.' + cssName.alertBox)) {
      $box.prepend(this.element)
    }
    this.data.display = 'show'
    this.show()
  }

  hideBox() {
    const cssName = this.options.cssName
    const $box = this.options.$screenContainer
    if ($box.querySelector('.' + cssName.alertBox)) {
      this.data.display = 'hide'
      this.hide()
    }
  }

  show() {
    this.element.style.opacity = 1
    this.element.style.display = 'inline-block'
    this.resetPosition()
  }

  hide() {
    this.element.style.opacity = 0
    this.element.style.display = 'none'
  }
}

export default AlertBox