/**
 * @copyright: Copyright (C) 2019
 * @desc: FullScreenBar
 * @author: Jarry
 * @file: FullScreenBar.js
 */

import delegator from '../../toolkit/Delegator.js'
import BaseComponent from '../../base/BaseComponent'
import Utils from '../../utils/Utils'

const FULLSCREEN_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" gid="fullscreen" style="display:\${'fullscreenHide'}" width="20" height="20" viewBox="0 0 24 24">
<path d="M15 5.057V2h6.5a.5.5 0 0 1 .5.5V9h-2.943V5.057H15zm-6 0H5.057V9H2V2.5a.5.5 0 0 1 .5-.5H9v3.057zM15 22v-2.943h4.057V15H22v6.5a.5.5 0 0 1-.5.5H15zm-6 0H2.5a.5.5 0 0 1-.5-.5V15h3.057v4.057H9V22z" fill="#f1f1f1"></path>
</svg>
`
const FULLSCREEN_EXIT_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" gid="fullscreenExit" style="display:\${'fullscreenExitHide'}"  width="20" height="20" viewBox="0 0 24 24">
<path d="M22 5.943V9h-6.5a.5.5 0 0 1-.5-.5V2h2.943v3.943H22zm-20 0h3.943V2H9v6.5a.5.5 0 0 1-.5.5H2V5.943zM22 15v2.943h-4.057V22H15v-6.5a.5.5 0 0 1 .5-.5H22zM2 15h6.5a.5.5 0 0 1 .5.5V22H5.943v-4.057H2V15z" fill="#f1f1f1"></path>
</svg>
`
class FullScreen extends BaseComponent {
  template = this.createTemplate`
  <gp-button class="goldplay__control--fullscreen" title="${'title'}" data-status="${'status'}">
  ${'icon|html'}
  </gp-button>
  `
  data = {
    fullscreenHide: 'inline-block',
    fullscreenExitHide: 'none',
    // '' | fullscreen | exitfullscreen
    status: '',
    icon: FULLSCREEN_ICON,
    title: 'fullscreen'
  }
  options = {}

  constructor(options = {}) {
    super(options)
    this.options = options
    Object.assign(this.data, options.data)
    this.init()
  }

  watch() {
    if (this.data.status === 'fullscreen') {
      this.data.fullscreenHide = 'none'
      this.data.fullscreenExitHide = 'inline-block'
      this.data.title = 'exit fullscreen'
      this.data.icon = FULLSCREEN_EXIT_ICON
    } else {
      this.data.fullscreenHide = 'inline-block'
      this.data.fullscreenExitHide = 'none'
      this.data.title = 'fullscreen'
      this.data.icon = FULLSCREEN_ICON
    }
  }

  initProps() {
    this.getComponent('fullPage').initProps.call(this)
  }

  bindEvent() {
    const $container = this.options.$container
    const cssName = this.options.cssName
    const doc = document
    const win = window
    this.eventsList.fullscreenchange = this.addEventListener(doc, 'fullscreenchange',  () => {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        this.fullScreen()
      } else {
        const fullPage = this.getComponent('fullPage')
        if (fullPage.data.status === 'fullpage') {
          $container.classList.remove(cssName.containerFullScreen)
          this.data.status = 'exitfullscreen'
          fullPage.fullPage()
        } else {
          this.exitFullScreen()
        }
      }
    })

    this.eventsList.windowresize = this.addEventListener(win, 'resize', () => {
      if (document.fullscreenElement) {
        this.resizeTo(screen.width, screen.height - (window.outerHeight - window.innerHeight))
        this.resetPosition()
      }
    })

    delegator(this.$controlBarContainer).on('click', '.' + cssName.fullScreen, () => {
      const status = this.data.status
      this.saveOriginPosition()
      if (status === 'fullscreen') {
        Utils.exitFullscreen()
      } else {
        Utils.Fullscreen()
      }
    })
  }

  fullScreen() {
    this.data.status = 'fullscreen'
    const options = this.options
    const cssName = this.options.cssName
    const size = {
      width: screen.width,
      height: screen.height - (outerHeight - innerHeight)
    }
    // trick for safari (title bar height)
    if(Utils.isSafari()) {
      size.height = size.height + 38
    }
    options.$container.classList.add(cssName.containerFullScreen)
    this.resizeTo(size.width, size.height)
    this.resetPosition()
    scrollTo(0, 0)
  }

  saveOriginPosition() {
    this.getComponent('fullPage').saveOriginPosition.call(this)
  }

  resizeTo(width, height) {
    this.getComponent('fullPage').resizeTo.call(this, width, height)
  }

  resetPosition() {
    this.getComponent('fullPage').resetPosition.call(this)
  }

  setProgressBarPosition() {
    this.getComponent('fullPage').setProgressBarPosition.call(this)
  }
  
  exitFullScreen() {
    this.data.status = 'exitfullscreen'
    const cssName = this.options.cssName
    this.saveOriginPosition()
    this.options.$container.classList.remove(cssName.containerFullScreen)
    this.resetScreen()
    this.saveOriginPosition()
  }

  resetScreen() {
    this.getComponent('fullPage').resetScreen.call(this)
  }
}

export default FullScreen