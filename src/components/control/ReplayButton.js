/**
 * @copyright: Copyright (C) 2019
 * @desc: ReplayButton
 * @author: Jarry
 * @file: ReplayButton.js
 */

import BaseComponent from '../../base/BaseComponent'

class ReplayButton extends BaseComponent {
  template = this.createTemplate`
  <gp-button class="goldplay__control--replay" title="${'title'}" data-display="${'display'}">
  <svg version="1.0" xmlns="http://www.w3.org/2000/svg"
  width="24px" height="24px" viewBox="0 0 245.000000 206.000000"
  preserveAspectRatio="xMidYMid meet">
 <g transform="translate(0.000000,206.000000) scale(0.100000,-0.100000)"
 fill="#f1f1f1" stroke="1">
 <path d="M1250 2046 c-286 -55 -525 -211 -681 -445 -91 -136 -152 -302 -167
 -453 -12 -119 3 -108 -143 -109 -70 -1 -156 -4 -192 -8 l-65 -6 262 -265 262
 -265 266 265 265 265 -62 6 c-35 4 -123 7 -197 8 l-134 1 7 69 c26 284 232
 543 504 635 201 69 404 53 596 -47 62 -32 103 -63 177 -137 83 -83 102 -108
 142 -190 63 -130 77 -193 77 -340 0 -178 -37 -298 -134 -435 -91 -126 -220
 -224 -369 -278 -72 -26 -99 -31 -218 -35 -117 -4 -146 -1 -215 17 -104 29
 -205 79 -283 142 l-63 52 -89 -89 c-49 -49 -89 -96 -89 -106 0 -24 154 -136
 253 -185 89 -44 177 -74 272 -95 84 -17 303 -15 391 5 403 91 691 371 795 772
 19 76 23 114 22 240 0 129 -4 164 -27 249 -99 377 -406 673 -778 751 -104 22
 -297 28 -385 11z"/>
 <path d="M1227 1418 c-9 -68 -7 -695 2 -770 l6 -57 240 200 c132 110 251 210
 264 223 l23 24 -257 213 c-141 118 -260 215 -264 217 -5 1 -11 -21 -14 -50z"/>
 </g>
 </svg>
  </gp-button>
  `
  data = {
    title: 'replay',
    display: '',
    replay: '->'
  }
  options = {}
  constructor(options = {}) {
    super(options)
    this.options = options
    Object.assign(this.data, options.data)
    this.init()
  }

}

export default ReplayButton