/**
 * @copyright: Copyright (C) 2019
 * @desc: base pool for data
 * @author: Jarry
 * @file: BasePool.js
 */
class BasePool extends Array {

  constructor() {
    super()
  }

  get size() {
    return this.length
  }

  add(data) {
    this.push(Object.freeze(data))
  }

  addAll(dataList) {
    dataList.forEach(data => {
      this.add(data)
    })
  }

  get(index) {
    return this[index]
  }

  getLast() {
    return this[this.length - 1]
  }

  getBy(func) {
    if (typeof func !== 'function') return
    let result = new(this.constructor)()
    this.every((model, idx) => {
      if (func.call(this, model, idx, this) === true) {
        result.add(model)
      }
      return true
    })
    return result
  }

  /**
   * find item by range time between start and end
   * @param {number} time start-end time
   * @param {Function} match [option] comparison time function
   */
  indexOfByTime(time, match) {
    if (!match) {
      // (start, end]
      match = item => time >= item.start && time < item.end
    }
    let len = this.length - 1
    for (let i = 0; i <= len;) {
      let mid = Math.floor((len + i) / 2)
      let item = this[mid]
      if (match(item)) {
        return mid
      } else if (item.start > time) {
        len = mid - 1
      } else {
        i = mid + 1
      }
    }
    return -1
  }

  getByTime(time) {
    let idx = this.indexOfByTime(time)
    if (idx >= 0) {
      return this[idx]
    }
  }

  getByKey(...keys) {
    if (Array.isArray(keys[0])) {
      keys = keys[0]
    }
    return this.getBy(
      (model) => {
        let result = false
        keys.every((key) => {
          if (Object.prototype.hasOwnProperty.call(model, key)) {
            result = true
            return false
          }
          return true
        })
        return result
      }
    )
  }

  getByValue(...values) {
    if (Array.isArray(values[0])) {
      values = values[0]
    }
    return this.getBy(
      (model) => {
        let result = false
        model.each((key, value) => {
          if (values.includes(value)) {
            result = true
            // if have any same value, break current each
            return false
          }
        })
        return result
      }
    )
  }

  getByKeyValue(key, value) {
    return this.getBy((model) => {
      return model[key] === value
    })
  }
  getValues(...keys) {
    if (Array.isArray(keys[0])) {
      keys = keys[0]
    }
    return this.map(function (model) {
      if (keys.length) {
        return model.get(model, keys)
      } else {
        return model.getValues(model)
      }
    })
  }
  indexOfBy(func) {
    let i = 0,
      l = this.length
    func = func || function () {
      return false
    }
    while (i < l) {
      if (func.call(this, this[i], i, this) === true) {
        return i
      }
      i++
    }
    return -1
  }

  indexOfByKey(key, value) {
    return this.indexOfBy((model) => {
      return model[key] === value
    })
  }

  indexOfByKeyValue(key, value) {
    return this.indexOfByKey(key, value)
  }

  /** alias of forEach */
  each(func) {
    if (typeof func !== 'function') return
    this.forEach(func)
    return this
  }

  /**
   * remove member from List
   * [start, end), interval to be left-closed and right-open
   * @param {number} start
   * @param {number} end [optional]
   */
  remove(start, end) {
    if (this.length <= 0) {
      return this
    }
    start = start < 0 ? 0 : start
    end = end || start + 1
    this.splice(start, end - start)
    return this
  }

  removeItem(...items) {
    if (Array.isArray(items[0])) {
      items = items[0]
    }
    return this.removeBy((model) => {
      return items.includes(model)
    })
  }

  /** remove item by condition */
  removeBy(func) {
    for (let i = 0, l = this.length; i < l; i++) {
      if (func.call(this, this[i], i, this) === true) {
        this.splice(i, 1)
        l--
        i--
      }
    }
    return this
  }
  removeByKeyValue(key, value) {
    return this.removeBy((model) => {
      return model[key] === value;
    })
  }

  toJSON() {
    let list = Array.from(this)
    list.forEach(function (model, i) {
      list[i] = (model && typeof model.toJSON === 'function') ?
        model.toJSON() : model
    })
    return list
  }

  toArray() {
    return Array.from(this)
  }
}

export default BasePool