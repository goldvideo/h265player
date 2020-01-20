/**
 * Copyright (C) 2019.
 * All Rights Reserved.
 * @file Template.js
 * @desc
 * Simple template engine based on string substitution processing
 * Support `slot` and `function` from extract pip separator
 * @author Jarry
 */
import Logger from './Logger.js'

let logger = Logger.get('Template.js')

export class Template {
  constructor() {}

  static mergeVar(tpl, data = {}) {
    if (typeof tpl !== 'string' || tpl === '') {
      return tpl
    }
    try {
      let str = ''
      let reg = new RegExp('\\${\'?"?\\s*' + '([.:a-z0-9_s]+?)' + '\\s*\'?"?}', 'ig')
      str = tpl.replace(reg, (tpl, name) => {
        name = name.trim()
        let value = data[name]
        value = (value === null) ? '' : value
        value = (value === undefined) ? '' : value
        value = (!value) ? '' : value
        return value
      })
      return str
    } catch (e) {
      logger.error('mergeVar', 'replace variable', 'error:', e)
      return tpl
    }
  }

  static makeValue(key, value, keyType) {
    if (typeof value !== 'string' && typeof value !== 'function') {
      return value
    }
    // the value using Template.create`` declaration will returns a function
    if (typeof value === 'function') {
      value = value.call(this, this.data)
    }
    // Normal variable will returns text
    if (!keyType) {
      return Template.escapeHTML.call(this, value)
    }
    const _getSlot = (componentName) => {
      let replacelotFlag = ''
      if (componentName) {
        replacelotFlag = ` ${Template.slotReplaceName}="true"`
      }
      return `<gp-slot style="display:none"${replacelotFlag}></gp-slot>`
    }
    let componetName
    // markup the slot flag for slotType(html|component)
    if (Template.isSoltType(keyType)) {
      if (typeof this.getComponent !== 'function') {
        logger.error('makeValue', 'the object is not support slot mode.', this.getComponent, value)
        return value
      }
      switch(keyType) {
        case Template.slotTypeMap.component: {
          componetName = value
          let component = this.getComponent(componetName)
          if (typeof component === 'object' && component.element) {
            component.element.setAttribute(Template.slotReplaceName, 'true')
            value = component.element.outerHTML
          } else {
            value = _getSlot(componetName)
          }
          break
        }
        case Template.slotTypeMap.html:
          // the value is declared by String directly
          value = Template.mergeVar.call(this, value, this.data)
          break
        default:
          break
      }
      // append slot flag to template
      let slotComNameStr = ''
      if (componetName !== undefined) {
        slotComNameStr = ` ${Template.slotComName}="${componetName}" `
      }
      const replaced = '$1 ' + Template.slotTypeName + '="' + keyType + '" ' + Template.slotKeyName + '="' + key + '"' + slotComNameStr + '$2'
      if (typeof value === 'string') {
        value = value === '' ? _getSlot() : value
        value = value.replace(/^\s*(<\s?[\w-]*)(.*[\r|\n|>])/, replaced)
      }
      return value
    } else if (typeof keyType === 'string') {
      // extract method and convert the value
      const method = TemplateUtil[keyType]
      if (typeof method === 'function') {
        value = method.call(this, value)
      }
      return value
    }

    return Template.escapeHTML.call(this, value)
  }

  static escapeHTML(str) {
    if (typeof str !== 'string') {
      return str
    }
    return str.replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }

  static generate(strings, keys, values) {
    const dict = values[values.length - 1] || {}
    let result = [strings[0]]
    keys.forEach((key, i) => {
      if (!key) {
        return
      }
      // extract the keyType by pip separator
      const keyName = key.split(Template.pipSeparator)
      let value, keyType
      if (keyName.length > 1) {
        key = keyName[0]
        keyType = keyName[1]
      }
      value = Number.isInteger(key) ? values[key] : dict[key]
      const makeValue = Template.makeValue.bind(this)
      value = makeValue(key, value, keyType)
      if (value !== undefined) {
        result.push(value)
      }
      if (strings[i + 1] !== undefined) {
        result.push(strings[i + 1])
      }
    })
    return result.join('')
  }

  /**
   * @usage
   * const obj = { data: Object, getComponent: Function }
   * obj.createTemplate = Template.create.bind(obj)
   * 1. pass template string, support html|component slot
   * obj.template = obj.createTemplate`<div>this is ${'key'}, ${icon|html'} ${'speedBarName|component'} </div>`
   * const result = obj.template({ key: '<b>keyValue</b>', icon: '<img src="xxx">', speedBarName: 'speed' })
   * output: <div>this is &lt;b&gt;keyValue&lt;/b&gt; <img src="xxx"> speedComponetContent </div>
   * 
   * the value have three types: 
   * - string, default value no pipe charater
   * - slot type from pipe character, includes html or component(the value must be component name)
   * - util function from pipe character, use function to process data value
   * 
   * 2. pass string, not support html|component slot
   * obj.template = obj.createTemplate('<div>this is ${'key'}</div>')
   * const result = obj.template({ key: 'keyValue' })
   * output: <div>this is keyValue</div>
   * 
   * 3. pass function, support html|component slot
   * obj.template = obj.createTemplate(
   *  (data, create, obj) => create`<div>this is ${data.key}, ${'key'}, ${obj.data.key}</div>`
   * )
   * const result = obj.template({ key: 'keyValue' })
   * output: <div>this is keyValue, keyValue, keyValue</div>
   * @param {Array|String|Function} tplObj
   * @param  {...any} keys
   * @returns Function
   */
  static create(tplObj, ...keys) {
    let tplType
    if (Array.isArray(tplObj)) {
      tplType = 'array'
    } else if (typeof tplObj === 'function') {
      tplType = 'function'
    } else {
      tplType = 'string'
    }
    const self = this
    if (typeof self !== 'object' && typeof self !== 'function') {
      logger.error('create', 'this is not an object.', self)
      return
    }
    if (tplObj === undefined || tplObj === '') {
      logger.error('create', 'have not give tplObj parameter.', tplObj)
      return
    }
    if (self.data === undefined || self.data === null) {
      logger.info('create', 'this object.data is undefined or null', self)
      self.data = {}
    }

    switch(tplType) {
      case 'array':
        return function (...values) {
          const dict = values[values.length - 1] || {}
          if (typeof self === 'object') {
            self.__template__ = {
              tplObj,
              keys,
              dict
            }
          }
          const generate = Template.generate.bind(self)
          return generate(tplObj, keys, values)
        }
      case 'function': {
        const create = Template.create.bind(self)
        return tplObj.call(self, self.data, create, self)
      }
      default:
        return function(data) {
          data = data !== undefined ? data : self.data
          return Template.mergeVar(tplObj, data)
        }
    }
  }

  static isSoltType(type) {
    type = String(type).toLowerCase()
    return Template.slotTypeMap[type]
  }
}

Template.pipSeparator = '|'
Template.slotTypeName = 'gp-slot-type'
Template.slotKeyName = 'gp-slot-key'
Template.slotComName = 'gp-slot-com'
Template.slotReplaceName = 'gp-slot-replace'
Template.slotTypeMap = {
  html: 'html',
  component: 'component'
}
const TemplateUtil = {
  trim(str) {
    return str.trim()
  },
  upperCase(str) {
    return str.toUpperCase()
  },
  lowerCase(str) {
    return str.toLowerCase()
  }
}

export default Template