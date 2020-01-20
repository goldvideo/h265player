/**
 * @copyright: Copyright (C) 2019
 * @desc: FullPageBar
 * @author: Jarry
 * @file: FullPage.js
 */

import delegator from '../../toolkit/Delegator.js'
import BaseComponent from '../../base/BaseComponent'
import Utils from '../../utils/Utils'
import Template from '../../toolkit/Template'

const FULLPAGE_ICON = Template.create`
<svg xmlns="http://www.w3.org/2000/svg" style="display:${'fullpageHide'}" width="20" height="20" viewBox="0 0 24 24">
  <path d="M2.5 4h19a.5.5 0 0 1 .5.5v15a.5.5 0 0 1-.5.5h-19a.5.5 0 0 1-.5-.5v-15a.5.5 0 0 1 .5-.5zM5 7v10h14V7H5z" fill="#f1f1f1"></path>
</svg>
`
const FULLPAGE_EXIT_ICON = Template.create`
<svg xmlns="http://www.w3.org/2000/svg" style="display:${'fullpageExitHide'}" width="20" height="20" viewBox="0 0 24 24">
<path d="M3.5 6h17a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5h-17a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5zM6 9v6h12V9H6z" fill="#f1f1f1"></path>
</svg>
`

class FullPage extends BaseComponent {
  containerOriginStyle = ''
  template = this.createTemplate`
  <gp-button class="goldplay__control--fullpage" title="${'title'}" data-status="${'status'}">
  ${'icon|html'}
  </gp-button>
  `
  // template = this.createTemplate`
  // <gp-button class="goldplay__control--fullpage" title="${'title'}" data-status="${'status'}">
  // <svg xmlns="http://www.w3.org/2000/svg" style="display:${'fullpageHide'}" width="20" height="20" viewBox="0 0 24 24">
  //   <path d="M2.5 4h19a.5.5 0 0 1 .5.5v15a.5.5 0 0 1-.5.5h-19a.5.5 0 0 1-.5-.5v-15a.5.5 0 0 1 .5-.5zM5 7v10h14V7H5z" fill="#f1f1f1"></path>
  // </svg>
  // <svg xmlns="http://www.w3.org/2000/svg" style="display:${'fullpageExitHide'}" width="20" height="20" viewBox="0 0 24 24">
  //   <path d="M3.5 6h17a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5h-17a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5zM6 9v6h12V9H6z" fill="#f1f1f1"></path>
  // </svg>
  // </gp-button>
  // `
  data = {
    fullpageHide: '',
    fullpageExitHide: 'none',
    // '' | fullpage | exitfullpage
    status: '',
    icon: FULLPAGE_ICON,
    title: 'fullpage'
  }

  constructor(options = {}) {
    super(options)
    this.options = options
    Object.assign(this.data, options.data)
    this.init()
  }

  options = {}
  watch() {
    if (this.data.status === 'fullpage') {
      this.data.fullpageHide = 'none'
      this.data.fullpageExitHide = 'inline-block'
      this.data.title = 'exit fullspage'
      this.data.icon = FULLPAGE_EXIT_ICON
    } else {
      this.data.fullpageHide = 'inline-block'
      this.data.fullpageExitHide = 'none'
      this.data.title = 'fullpage'
      this.data.icon = FULLPAGE_ICON
    }
  }

  initProps() {
    const options = this.options
    this.$container = this.options.$container
    this.$screenContainer = options.$screenContainer
    this.$controlBarContainer = this.getComponent('controlBarContainer').element
    this.originWidth = options.$container.offsetWidth
    this.originHeight = options.$container.offsetHeight
    this.containerOriginStyle = options.$container.getAttribute('style')
    this.screenContainerOrginStyle = this.$screenContainer.getAttribute('style')
    this.controlContainerOrginWidth = this.$controlBarContainer.style.width
  }

  bindEvent() {
    const cssName = this.options.cssName
    const doc = document
    const win = window
    delegator(this.$controlBarContainer).on('click', '.' + cssName.fullPage, () => {
      const status = this.data.status
      const fullScreen = this.getComponent('fullScreen')
      if (fullScreen.data.status === 'fullscreen') {
        Utils.exitFullscreen()
      }
      if (status === 'fullpage') {
        this.exitFullPage()
      } else {
        this.fullPage()
      }
    })
    this.eventsList.esckeyup = this.addEventListener(doc, 'keyup', (evt) => {
      if (evt.keyCode === 27 && this.data.status === 'fullpage') {
        this.exitFullPage()
      }
    })

    this.eventsList.windowresize = this.addEventListener(win, 'resize', () => {
      if (this.data.status === 'fullpage') {
        const size = Utils.getInnerWidthHeight()
        this.resizeTo(size.width, size.height)
        this.resetPosition()
      }
    })

    /* delay resize */
    // let resizing = false
    // addEventListener('resize', (evt) => {
    //   const INTERVAL = 200
    //   if (this.data.status === 'fullpage') {
    //     if (!resizing) {
    //       setTimeout( () => {
    //         const size = Utils.getInnerWidthHeight()
    //         this.resizeTo(size.width, size.height)
    //         resizing = false
    //       }, INTERVAL)
    //     }
    //     resizing = true
    //   }
    // })
  }

  fullPage() {
    this.data.status = 'fullpage'
    const options = this.options
    const cssName = this.options.cssName
    const size = Utils.getInnerWidthHeight()
    this.saveOriginPosition()
    options.$container.classList.add(cssName.containerFullPage)
    this.resizeTo(size.width, size.height)
    this.resetPosition()
    scrollTo(0, 0)
  }

  saveOriginPosition() {
    const progressBar = this.getComponent('progressBar')
    this.posterOriginStyle = this.getComponent('poster').element.getAttribute('style')
    this.originScroll = {
      scrollX, scrollY
    }
    this.progressBarOriginLeft = progressBar.progressBarLeft
    this.progressBarOriginWidth = progressBar.progressBarWidth
    this.progressBarPlayWidthRate = progressBar.getProgressPlayLeftWidth().offsetWidth / this.progressBarOriginWidth
    this.progressBarLoadWidthRate = progressBar.getProgressLoadLeftWidth().offsetWidth / this.progressBarOriginWidth
    this.progressBarLoadLeftRate = (progressBar.getProgressLoadLeftWidth().offsetLeft - this.progressBarOriginLeft) / this.progressBarOriginWidth
  }

  setProgressBarPosition() {
    const progressBar = this.getComponent('progressBar')
    const progressBarWidth = progressBar.progressBarWidth
    const progressBarLeft = progressBar.progressBarLeft
    const playWidth = progressBarWidth * this.progressBarPlayWidthRate
    const loadWidth = progressBarWidth * this.progressBarLoadWidthRate
    const loadRelativeLeft = progressBarWidth * this.progressBarLoadLeftRate
    progressBar.setProgressPosition(playWidth)
    progressBar.setProgressLoadLeftWidth(loadRelativeLeft + progressBarLeft, loadWidth)
    this.getComponent('progressBar').clearDragDotTop()
  }

  resizeTo(width, height) {
    const options = this.options
    const player = options.player
    const screenHeight  = player.controlBarAutoHide ? height : height - player.controlBarHeight
    player.$screenContainer.style.width = width + 'px'
    player.$screenContainer.style.height = screenHeight + 'px'
    options.$container.style.width = width + 'px'
    options.$container.style.height = height + 'px'
  }

  resetPosition() {
    const options = this.options
    this.setProgressBarPosition()
    options.player.resizeScreen()
    this.getComponent('bigPlayButton').resetPosition()
    this.getComponent('poster').resetPosition()
    this.getComponent('waitingBar').resetPosition()
    this.getComponent('controlBarContainer').resetPosition()
  }

  exitFullPage() {
    this.data.status = 'exitfullpage'
    const cssName = this.options.cssName
    this.saveOriginPosition()
    this.$container.classList.remove(cssName.containerFullPage)
    this.resetScreen()
  }

  resetScreen() {
    this.$container.setAttribute('style', this.containerOriginStyle)
    this.$screenContainer.setAttribute('style', this.screenContainerOrginStyle)
    this.$controlBarContainer.style.width = this.controlContainerOrginWidth
    this.getComponent('poster').element.setAttribute('style', this.posterOriginStyle)
    scrollTo(this.originScroll.scrollX, this.originScroll.scrollY)
    this.resetPosition()
  }

}

export default FullPage