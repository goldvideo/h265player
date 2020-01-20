/**
 * @copyright: Copyright (C) 2019
 * @desc: Play Button
 * @author: Jarry
 * @file: PlayButton.js
 */

import BaseComponent from '../../base/BaseComponent'

class PlayButton extends BaseComponent {
  template = this.createTemplate`
  <gp-button class="goldplay__control--play" data-status="${'status'}" title="${'title'}">
  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
  viewBox="0 0 232.153 232.153" width="20" height="20" style="enable-background:new 0 0 232.153 232.153;" xml:space="preserve">
  <g >
  <path style="fill-rule:evenodd;clip-rule:evenodd;" d="M203.791,99.628L49.307,2.294c-4.567-2.719-10.238-2.266-14.521-2.266
    c-17.132,0-17.056,13.227-17.056,16.578v198.94c0,2.833-0.075,16.579,17.056,16.579c4.283,0,9.955,0.451,14.521-2.267
    l154.483-97.333c12.68-7.545,10.489-16.449,10.489-16.449S216.471,107.172,203.791,99.628z" fill="#f1f1f1"/>
  </g>
  </svg>
  </gp-button>
  `
  data = {
    title: 'play',
    play: '>'
  }
  options = {}
  constructor(options = {}) {
    super(options)
    this.options = options
    Object.assign(this.data, options.data)
    this.init()
  }

}

export default PlayButton