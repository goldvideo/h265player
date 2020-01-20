/**
 * Copyright (C) 2019.
 * All Rights Reserved.
 * @file Utils.js
 * @desc
 * global public tool utils
 * @author Jarry
 */
import loadjs from 'loadjs'

function is(clazz = 'Object') {
  return function (obj) {
    let type = '[object ' + clazz + ']'
    return (Object.prototype.toString.call(obj) == type)
  }
}
export default class Utils {

  static isObject = () => is('Object')
  static isString = () => is('String')
  static isFunction = () => is('Function')
  /**
   * load script dynamic
   * @param {String} urls 
   * @param {Function} callback 
   * @param {Object} error 
   */
  static importScripts(urls, callback, error) {
    let name = 'ready' + Date.now()
    if (urls instanceof Array) {
      loadjs(urls, name)
    } else {
      loadjs([urls], name)
    }

    loadjs.ready(name, {
      success: callback,
      error: error
    })
  }
  static blobData(str) {
    let blob = new Blob([str], { type: 'application/javascript' })
    return URL.createObjectURL(blob)
  }

  static escapeHTML(str) {
    if (!(Utils.isString(str))) {
      return
    }
    return str.replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
 }

  static getInnerWidthHeight() {
    return {
      width: window.innerWidth,
      height: window.innerHeight
    }
  }

  static Fullscreen() {
    const ele = document.documentElement
    if (ele .requestFullscreen) {
      ele .requestFullscreen()
    } else if (ele .mozRequestFullScreen) {
      ele .mozRequestFullScreen()
    } else if (ele .webkitRequestFullScreen) {
      ele .webkitRequestFullScreen()
      setTimeout(()=> {
        console.error('fullscreen success')
        document.dispatchEvent(new Event('fullscreenchange'))
      }, 0)
    }
  }

  static exitFullscreen() {
    const doc = document
    if (doc.exitFullscreen) {
      doc.exitFullscreen()
    } else if (doc.mozCancelFullScreen) {
      doc.mozCancelFullScreen()
    } else if (doc.webkitExitFullscreen) {
      doc.webkitExitFullscreen()
      setTimeout(()=> {
        console.error('exitfullscreen success')
        document.dispatchEvent(new Event('fullscreenchange'))
      }, 0)
    }
  }

  static buildFilePath(files, path) {
    return files.map(value => {
      return path + value
    })
  }

  static insertSort(array, target, filter) {
    let length = array.length
    let key, value
    if (length === 0) {
      array.push(target)
      return
    }

    if (filter) {
      ({ key, value } = filter(target))
      for (let i = 0; i < length; i++) {
        if (value < array[i][key]) {
          let j = length
          while (j > i) {
            array[j] = array[j - 1]
            j--
          }
          array[i] = target
          return
        }
      }
      array.push(target)
      return
    } else {
      value = target
      for (let i = 0; i < length; i++) {
        if (value < array[i]) {
          let j = length
          while (j > i) {
            array[j] = array[j - 1]
            j--
          }
          array[i] = value
          return
        }
      }
    }

    array.push(value)
  }

  static isSafari() {
    let ua = navigator.userAgent
    return /Safari/.test(ua) && !/Chrome/.test(ua)
  }

  static msec2sec(msec) {
    let sec = (msec / 1000).toFixed(3)
    return parseFloat(sec, 10)
  }
}
