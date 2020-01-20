/**
 * Copyright (C) 2019.
 * All Rights Reserved.
 * @file Logger.js
 * @desc
 * logger tool
 * level: 3(error), 2(debug, warn, >2), 1(log, >1), 0(info, >0). the default is 0.
 * @author Jarry
 */
import { Config } from '../config/Config.js'
const _console = console || {}
const methodList = ['info', 'log', 'debug', 'warn', 'error']
// const methodList = Object.keys(_console)

function echo(fn, message, ...data) {
  if (_console[fn]) {
    if (this.disabled || this.level < 0) {
      return
    }
    if (Config.mode === 'production' && (fn !== 'error' || fn !== 'warn')) {
      return
    }

    if (this.level === 1 && (['info'].includes(fn))) {
      return
    }
    if (this.level === 2 && (['log', 'info'].includes(fn))) {
      return
    }
    if (this.level > 2 && fn !== 'error') {
      return
    }
    const time = (new Date().toLocaleString())
    let arr = [`\x1b[32m${message}\x1b[39m`, ...data, time]
    if (fn === 'error' || fn === 'warn') {
      arr = [message, ...data, time]
    }
    if (typeof _console[fn] === 'function') {
      _console[fn].apply(_console, arr)
    }
  }
}
/**
 * 日志处理类
 * @usage
 * let logger = new Logger('文件名.js')
 * logger.log[info|error|warn]('方法', '动作', '数据1:', '数据结果1', '数据2:', '数据结果2', ...)
 */
class Logger {
  prefix = Config.projectName
  joiner = '>'
  left = '['
  right = ']'

  disabled = false
  level = 0

  constructor(file, options = {}) {
    Object.assign(this, options)
    if (typeof file == 'string') {
      this.file = file
    } else if (file && file.constructor) {
      this.file = file.constructor.name
    }
  }

  setDisabled(isDisabled) {
    this.disabled = isDisabled
  }

  setLevel(level) {
    this.level = level
  }

  static get(file, options) {
    return new Logger(file, options)
  }
}

methodList.forEach((item) => {
  Logger.prototype[item] = function (method, action, ...data) {
    action = action === undefined ? '' : this.joiner + action
    const methodAction = this.left + method + action + this.right
    const message = this.left + this.prefix + ' ' + this.file + this.right + methodAction
    echo.apply(this, [item, message, ...data])
  }
})

export default Logger