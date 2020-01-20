/**
 * @copyright: Copyright (C) 2019
 * @desc: base model, provide some common methods
 * @author: Jarry
 * @file: BaseModel.js
 */

class BaseModel {
  constructor() {
  }
  pair() {
    return Object.entries(this)
  }
  keys() {
    return Object.keys(this)
  }
  set(key, value) {
    this[key] = value
    return this
  }
  get(key) {
    return this[key]
  }
  add(key, value) {
    if (!Object.prototype.hasOwnProperty.call(this, key)) {
      this.set(key, value)
    }
    return this
  }
  addAll(obj) {
    for (let key in obj) {
      this.add(key, obj[key])
    }
    return this
  }

  toJSON() {
    let result = {}
    for(let item in this) {
      if (Object.prototype.hasOwnProperty.call(this, item)) {
        result[item] = this[item]
      }
    }
    return result
  }
}

export default BaseModel