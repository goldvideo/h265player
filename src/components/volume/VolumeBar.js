/**
 * @copyright: Copyright (C) 2019
 * @file VolumeBar.js
 * @desc
 * VolumeBar
 * @see
 * @author Jarry
 */

import delegator from '../../toolkit/Delegator.js'
import dragger from '../../toolkit/Dragger.js'
import BaseComponent from '../../base/BaseComponent'
import Events from '../../config/EventsConfig'
import { Config } from '../../config/Config'
import Template from '../../toolkit/Template'

const AUDIO_ON_ICON = Template.create`
<svg xmlns="http://www.w3.org/2000/svg" style="display:${'audioOnHide'}" width="20px" height="20px" viewBox="0 0 24 24" style="margin-left: -5px;">
<path d="M5.2 7.68l6.175-5.293a.5.5 0 0 1 .825.38v17.825a.5.5 0 0 1-.825.38L5.2 15.679H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h2.2zm9 13.35v-2.375l.007-.003C16.852 17.493 19 14.897 19 11.479s-2.148-6.014-4.793-7.173a4.11 4.11 0 0 0-.007-.003V2c.027.006.054.012.082.02.852.221 1.274.453 1.436.535A10 10 0 0 1 21.2 11.48c0 4.106-2.474 7.633-6.013 9.174-.526.229-.583.284-.987.377zm0-13.973c1.5.925 2.5 2.582 2.5 4.473 0 1.892-1 3.55-2.5 4.473V7.057z" fill="#f1f1f1"></path>
</svg>
`
const AUDIO_OFF_ICON = Template.create`
<svg xmlns="http://www.w3.org/2000/svg" style="display:${'audioOffHide'}" width="20px" height="20px" viewBox="0 0 24 24" style="margin-left: -5px;">
<path d="M12.2 13.914v6.678a.5.5 0 0 1-.825.38L5.2 15.679H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h2.2l.412-.353-2.558-2.558a.5.5 0 0 1 0-.707l.707-.707a.5.5 0 0 1 .707 0l16.849 16.849a.5.5 0 0 1 0 .707l-.707.707a.5.5 0 0 1-.707 0l-2.386-2.386a10 10 0 0 1-2.33 1.422c-.526.229-.583.284-.987.377v-2.375l.007-.003a8.332 8.332 0 0 0 1.717-1.014l-1.67-1.669a5.251 5.251 0 0 1-.054.034v-.089l-2-2zM8.373 4.96l3.002-2.572a.5.5 0 0 1 .825.38v6.019L8.373 4.959zm9.867 9.867c.48-.99.76-2.115.76-3.347 0-3.418-2.148-6.014-4.793-7.173a4.11 4.11 0 0 0-.007-.003V2c.027.006.054.012.082.02.852.221 1.274.453 1.436.535A10 10 0 0 1 21.2 11.48a9.954 9.954 0 0 1-1.326 4.98l-1.634-1.633zm-1.766-1.766L14.2 10.786V7.057a5.247 5.247 0 0 1 2.274 6.003z" fill="#f1f1f1"></path>
</svg>
`
class VolumeBar extends BaseComponent {
  template = this.createTemplate`
  <gp-volume class="goldplay__volume-bar">
    <gp-overbox class="goldplay-hoverbox goldplay__volume-bar--handle">
      <span class="goldplay__volume-bar--precent">${'dataPrecent'}</span>
      <span class="goldplay__volume-bar--rod ${'volumeBarRodHoverCss'}" title="adjust volume"></span>
      <span class="goldplay__volume-bar--size">&nbsp;</span>
      <span class="goldplay__volume-bar--column">&nbsp;</span>
    </gp-overbox>
    <gp-button class="goldplay__volume-bar--audio ${'audioOffClass'}" title="${'title'}" data-mute="${'dataMute'}" data-volume-size="${'dataVolumeSize'}"  data-last-volume="${'dataLastVolume'}">
    ${'icon|html'}
    </gp-button>
  </gp-volume>
  `
  options = {}
  data = {
    audioONHide: '',
    audioOffHide: '',
    audioOffClass: '',
    dataVolumeSize: '',
    dataPrecent: '',
    dataLastVolume: '',
    dataMute: '',
    volumeBarRodHoverCss: '',
    icon: AUDIO_ON_ICON,
    title: 'turn off'
  }

  constructor(options = {}) {
    super(options)
    this.options = options
    Object.assign(this.data, options.data)
    this.init()
  }

  watch() {
    this.data.dataPrecent = Math.floor(this.data.dataVolumeSize * 100)
    if (this.data.audioOffClass !== '') {
      this.data.dataMute = 'true'
      this.data.audioOffHide = 'inline-block'
      this.data.audioOnHide = 'none'
      this.data.icon = AUDIO_OFF_ICON
      this.data.title = 'turn on'
    } else {
      this.data.dataMute = ''
      this.data.audioOffHide = 'none'
      this.data.audioOnHide = 'inline-block'
      this.data.icon = AUDIO_ON_ICON
      this.data.title = 'turn off'
    }
  }

  initProps() {
    const $volumeBar = this.element
    const cssName = this.options.cssName
    this.INIT_VOLUME_SIZE = this.options.player.defaultVolumeSize === undefined ? 0.50 : this.options.player.defaultVolumeSize
    this.$volumeBarHandle = $volumeBar.querySelector('.' + cssName.volumeBarHandle)
    this.$volumeBarRod = $volumeBar.querySelector('.' + cssName.volumeBarRod)
    this.$volumeBarAudio  = $volumeBar.querySelector('.' + cssName.volumeBarAudio)
    this.$volumeBarSize = $volumeBar.querySelector('.' + cssName.volumeBarSize)
    this.$volumeBarColumn  = $volumeBar.querySelector('.' + cssName.volumeBarColumn)
    this.volumeBarColumnHeight = this.$volumeBarColumn.offsetHeight
    this.volumeBarColumnTop = this.$volumeBarColumn.offsetTop
    this.volumeBarRodHeight = this.$volumeBarRod.offsetHeight
    this.volumeBarRodHeightHalf = this.volumeBarRodHeight / 2
    this.volumeBarColumnRealTop = this.volumeBarColumnTop + this.volumeBarRodHeightHalf
    this.volumeBarColumnMaxHeight = this.volumeBarColumnHeight - this.volumeBarRodHeight
  }

  bindEvent() {

    const $container = this.options.$controlBarContainer
    const cssName = this.options.cssName

    delegator($container).on('mouseover', '.' + cssName.volumeBar, () => {
      clearTimeout(volumeBarHidetimer)
      this.showVolumeBarHandle()
    })

    delegator($container).on('mousewheel', '.' + cssName.volumeBarHandle, (evt) => {
      let volumeSize = (evt.wheelDelta / 500)
      volumeSize = this.data.dataVolumeSize + volumeSize
      this.setVolumeSize(volumeSize)
      evt.preventDefault()
      evt.stopPropagation()
      return
    })
    delegator($container).on('click', ['.' + cssName.volumeBarColumn, '.' + cssName.volumeBarSize], (evt) => {
      let volumeSize = 0
      if (evt.target === this.$volumeBarColumn) {
        volumeSize = (this.$volumeBarColumn.offsetHeight - evt.offsetY) / evt.target.offsetHeight
      } else if (evt.target === this.$volumeBarSize) {
        volumeSize = (this.$volumeBarColumn.offsetHeight - evt.target.offsetHeight) + evt.offsetY
        volumeSize = this.$volumeBarColumn.offsetHeight - volumeSize
        volumeSize = volumeSize / this.$volumeBarColumn.offsetHeight
      }
      this.setVolumeSize(volumeSize)
      return false
    })
    delegator($container).on('click', '.' + cssName.volumeBarAudio, (evt) => {
      if (this.$volumeBarAudio.classList.contains(cssName.volumeBarAudioOff)) {
        this.setAudioOn(evt.offsetY)
      } else {
        this.setAudioOff(evt.offsetY)
      }
      return false
    })

    let volumeBarHidetimer
    const _inHandleScope = (evt) => {
      const $bar = this.element
      const scope = {
        y: $bar.offsetTop + this.$volumeBarHandle.offsetTop,
        x: $bar.offsetLeft
      }
      scope.width = $bar.offsetWidth
      scope.height = this.$volumeBarHandle.offsetHeight
      if (evt.pageX > scope.x && evt.pageX < (scope.x + scope.width)
      && evt.pageY > scope.y && evt.pageY < (scope.y + scope.height)
      ) {
        return true
      } else {
      return false
      }
    }
    delegator($container).on('mouseout', '.' + cssName.volumeBar, (evt) => {
      volumeBarHidetimer = setTimeout( () => {
      if (!_inHandleScope(evt)) {
          this.hideVolumeBarHandle()
        } else {
          clearTimeout(volumeBarHidetimer)
        }
      }, Config.hideBarBoxTime)
    })

    this.volumeDragEvent = dragger(this.$volumeBarRod, {
      $container: this.element,
      type: 'vertical',
      scope: {
        top: this.volumeBarColumnTop,
        right: 0,
        bottom: this.volumeBarColumnTop + this.volumeBarColumnHeight,
        left: 0
      },
      onStart: () => {
        this.data.volumeBarRodHoverCss = this.options.cssName.volumeBarRodHover
      },
      onDrag: (offsetX, offsetY) => {
        offsetY -= 1
        this.dragHandle(offsetY)
      },
      onRelease: () => {
        this.data.volumeBarRodHoverCss = ''
      }
    })
  }

  hideVolumeBarHandle() {
    this.$volumeBarHandle.style.visibility = 'hidden'
  }

  showVolumeBarHandle() {
    this.$volumeBarHandle.style.visibility = 'visible'
  }

  getVolume() {
    let volumeSize = (this.$volumeBarSize.offsetHeight - this.volumeBarRodHeight) / this.volumeBarColumnMaxHeight
    volumeSize = Math.min(volumeSize, 1)
    volumeSize = Math.max(volumeSize, 0)
    return volumeSize.toFixed(2)
  }

  setVolume(value) {
    this.data.dataVolumeSize = Number(value)
    this.events.emit(Events.PlayerOnVolume, value)
  }

  initVolumeSize() {
    this.data.dataLastVolume = this.INIT_VOLUME_SIZE
    this.setAudioOn()
  }

  setAudioOn() {
    const volume = this.data.dataLastVolume || 0
    this.setVolume(volume)
    const volumeSize = parseFloat(volume, 10)
    const volumeHeight = Math.floor(volumeSize * this.volumeBarColumnMaxHeight)
    const volumeSizeTop = this.volumeBarColumnTop + (this.volumeBarColumnMaxHeight - volumeHeight)
    this.$volumeBarSize.style.marginTop = volumeSizeTop + 'px'
    this.$volumeBarSize.style.height = volumeHeight + this.volumeBarRodHeight + 'px'
    this.$volumeBarRod.style.top = volumeSizeTop + 'px'
    this.data.audioOffClass = ''
  }

  setAudioOff() {
    this.setVolume(0)
    this.data.audioOffClass = this.options.cssName.volumeBarAudioOff
    const volumeSize = this.getVolume()
    if (volumeSize > 0) {
      this.data.dataLastVolume = volumeSize
    }
    this.$volumeBarSize.style.height = this.volumeBarRodHeight + 'px'
    this.$volumeBarSize.style.marginTop = this.volumeBarColumnRealTop - this.volumeBarRodHeightHalf + this.volumeBarColumnMaxHeight + 'px'
    this.$volumeBarRod.style.top = this.volumeBarColumnRealTop + this.volumeBarColumnMaxHeight - this.volumeBarRodHeightHalf + 'px'
  }

  dragHandle(offsetY) {
    this.$volumeBarSize.style.marginTop = offsetY + 1 + 'px'
    this.$volumeBarSize.style.height = (this.volumeBarColumnHeight - offsetY) + this.volumeBarRodHeight + 'px'
    const volumeSize = this.getVolume()
    if (volumeSize <= 0) {
      this.setAudioOff(offsetY)
    } else if (this.data.dataMute == 'true') {
      this.setAudioOn(offsetY)
    }
    this.setVolume(volumeSize)
  }

  setVolumeSize(volumeSize) {
    volumeSize = volumeSize.toFixed(2)
    if (volumeSize >= 1) {
      volumeSize = 1
    } else if (volumeSize < 0.001) {
      volumeSize = 0
    }

    if (volumeSize !== this.data.dataVolumeSize) {
      this.setVolume(volumeSize)
      const totalSize = this.volumeBarColumnMaxHeight
      const offsetY = totalSize - volumeSize * totalSize
      const marginTop = offsetY + this.volumeBarColumnTop
      this.$volumeBarSize.style.marginTop = marginTop + 'px'
      this.$volumeBarSize.style.height = volumeSize * totalSize + this.volumeBarRodHeight + 'px'
      this.$volumeBarRod.style.top = marginTop + 'px'

      if (volumeSize <= 0) {
        this.data.audioOffClass = this.options.cssName.volumeBarAudioOff
      } else if (this.data.dataMute == 'true') {
        this.data.audioOffClass = ''
      }
    }
  }

}

export default VolumeBar