/**
 * Copyright (C) 2019.
 * All Rights Reserved.
 * @file Format.js
 * @desc
 * common format utils
 * @author Jarry
 */
export const timeFormat = {
  formatHHMMSS(second) {
    const secondNum = parseInt(second, 10)
    let hours = Math.floor(secondNum / 3600)
    let minutes = Math.floor((secondNum - (hours * 3600)) / 60)
    let seconds = secondNum - (hours * 3600) - (minutes * 60)
    if (hours < 10) {
      hours = '0' + hours
    }
    if (minutes < 10) {
      minutes = '0' + minutes
    }
    if (seconds < 10) {
      seconds = '0' + seconds
    }
    let hoursStr = ''
    if (hours !== '00') {
      hoursStr = hours + ':'
    }
    return hoursStr + minutes + ':' + seconds
  }
}
  
export const sizeFormat = {
  formatBytes(bytes, decimals) {
    if(bytes == 0) return '0 Bytes'
    const k = 1024
    const dm = decimals <= 0 ? 0 : decimals || 2
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }
}

export default {
  timeFormat,
  sizeFormat
}