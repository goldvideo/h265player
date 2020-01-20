/**
 * Copyright (C) 2019.
 * All Rights Reserved.
 * @file HTTP.js
 * @desc
 * HTTP request tool by fetch API
 * @author Jarry
 * @see
 * https://github.github.io/fetch/
 */
import Logger from './Logger.js'
import { throwError } from '../error/ThrowError.js'
let logger = Logger.get('HTTP.js', { level: 2 })

const blob2ArrayBuffer = async blob => {
  if (blob instanceof Blob) {
    const arrayBuffer = await new Response(blob).arrayBuffer()
    return new Uint8Array(arrayBuffer, 0)
  }
}

function setHeaders({
  headers = {},
  method = 'get',
  username,
  password,
  token
} = {}) {
  const header = new Headers(headers)

  if (username || password) {
    if (!username)
      throw new TypeError('username required for basic authentication')
    if (!password)
      throw new TypeError('password required for basic authentication')

    const encode = typeof win === 'object' && win.btoa ? btoa : str => str
    header.set('Authorization', 'Basic ' + encode(username + ':' + password))
  }
  if (token) header.set('Authorization', 'Bearer ' + token)

  if (method !== 'get' && !header.get('content-type')) {
    header.set('content-type', 'application/json')
  }

  return header
}
const queryStringify = params => {
  if (!params) {
    return
  }
  return Object.entries(params).reduce((acc, entry, index) => {
    const [param, value] = entry
    const encoded =
      index === 0
        ? param + '=' + encodeURIComponent(value)
        : '&' + param + '=' + encodeURIComponent(value)
    return acc + encoded
  }, '')
}
const makeURL = opts => {
  const { url, params } = opts
  if (!params) {
    return url
  }
  return url + '?' + queryStringify(params)
}

function formatBody(opts) {
  const type = opts.headers.get('content-type')
  if (!type) {
    return
  }
  if (type.includes('json')) {
    return JSON.stringify(opts.body)
  }
  if (type.includes('x-www-form-urlencoded')) {
    return queryStringify(opts.body)
  }
  return opts.body
}

function getHeaders(response) {
  const getBrowserFetchHeaders = response => {
    const headers = Object.create(Object.getPrototypeOf(response.headers))
    for (let [header, value] of response.headers.entries()) {
      headers[header] = value
    }
    return headers
  }

  const getNodeFetchHeaders = response => {
    const headers = {}
    const h = response.headers.__headers__
    for (const header in h) {
      headers[header] = h[header].join('')
    }
    return headers
  }

  return response.headers.entries
    ? getBrowserFetchHeaders(response)
    : getNodeFetchHeaders(response)
}

function parseResponse(response, type) {
  // Response object can only be used once.
  // We clone the response object here so users can use it again if they want to.
  // Checks required because browser support isn't solid.
  // https://developer.mozilla.org/en-US/docs/Web/API/Response/clone

  const clone =
    typeof response.clone === 'function' ? response.clone() : undefined

  const passedResponse = clone || response
  const formatOutput = (response, body) => {
    const headers = getHeaders(response)
    // const headers = response.headers
    const returnValue = {
      body,
      headers,
      response,
      status: response.status,
      statusText: response.statusText
    }

    return response.ok
      ? Promise.resolve(returnValue)
      : Promise.reject(returnValue)
  }

  // This will do response.json(), response.text(), etc.
  // We use bracket notation to allow multiple types to be parsed at the same time.
  return response[type]().then(body => formatOutput(passedResponse, body))
}

function handleResponse(response, fileType) {
  const type = response.headers.get('content-type')
  const clone = response.clone()
  const reader = clone.body.getReader()
  let bytesReceived = 0
  const fetchDone = () => {
    if (fileType === 'ts' || fileType === 'video') {
      return parseResponse(response, 'blob')
    }
    if (type.includes('json')) return parseResponse(response, 'json')
    if (type.includes('text')) return parseResponse(response, 'text')
    if (type.includes('form')) return parseResponse(response, 'formData')
    if (
      type.includes('video') ||
      type.includes('image') ||
      type.includes('octet-stream')
    ) {
      return parseResponse(response, 'blob')
    }
    try {
      return parseResponse(response, 'text')
    } catch (e) {
      // Need to check Blob and ArrayBuffer content types
      throwError(e, '[HTTP>handleResponse:unknow content-type]', type, response)
      return Promise.resolve(response)
    }
  }

  let lastReceived = bytesReceived
  const intervalValue = 20
  const speedRatio = 1000 / intervalValue
  const loadedInterval = setInterval(() => {
    const speed = (bytesReceived - lastReceived) * speedRatio
    if (speed <= 1) {
      return
    }
    logger.info('HTTP>handleResponse', `${lastReceived} | ${bytesReceived}`, `${speed.toFixed(2)} Bytes/s`)
    self.postMessage({
      type: 'notice',
      method: 'fetch',
      noticeType: 'speed',
      data: {
        speed: speed,
        intervalValue: intervalValue,
        lastReceived: lastReceived,
        bytesReceived: bytesReceived
      }
    })
    lastReceived = bytesReceived
  }, intervalValue)
  return reader.read().then(function processResult(result) {
    if (result.done) {
      // console.error("Fetch complete")
      clearInterval(loadedInterval)
      return fetchDone()
    }
    bytesReceived += result.value.length
    return reader.read().then(processResult)
  })

}

class HTTP {
  options = {
    // 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
    'content-type': 'application/json;charset=UTF-8',
    cache: 'no-cache',
    // credentials: 'same-origin',
    // credentials: 'include',
    mode: 'cors'
    // redirect: 'follow',
    // referrer: 'no-referrer',
  }

  constructor(options) {
    Object.assign(this.options, options)
  }

  setOptions(options) {
    const opts = Object.assign(this.options, options)
    opts.url = makeURL(opts)
    opts.method = opts.method || 'get'
    opts.headers = setHeaders(opts)
    opts.body = formatBody(opts)

    delete opts.username
    delete opts.password
    delete opts.token

    this.options = opts
  }

  request(url, options = {}, fileType) {
    if (!url) {
      logger.error(
        '[HTTP>request]',
        'url is undefined',
        'url:',
        url,
        'options:',
        options
      )
      return
    }
    this.setOptions(
      Object.assign(
        {
          url
        },
        options
      )
    )
    return fetch(this.options.url, this.options).then(response => {
      return handleResponse(response, fileType)
    })
  }

  async fetch(url, options = {}, name, fileType) {
    if (!url) {
      logger.wran(
        '[HTTP>fetch]',
        'url is undefined',
        'url:',
        url,
        'options:',
        options
      )
      return
    }
    this.setOptions(
      Object.assign(
        {
          url
        },
        options
      )
    )
    logger.info('[HTTP>fetch]', 'http fetch', 'url:', url, 'options:', options)
    const data = await fetch(url, options)
    if (data.ok) {
      data.text().then(body => {
        self.postMessage({
          type: 'invoke',
          method: 'fetch',
          fileType: fileType,
          name: name,
          data: body
        })
      })
    } else {
      self.postMessage({ result: 'failed' })
    }
  }

  async get(url, options = {}, name, fileType) {
    options.method = 'get'
    logger.info(
      '[HTTP>get]',
      'http get',
      'url:',
      url,
      'options:',
      options,
      'name:',
      name,
      'fileType:',
      fileType
    )
    let data
    const postData = {
      type: 'invoke',
      method: 'get',
      fileType: fileType,
      name: name,
      url: url
    }
    try {
      data = await this.request.call(this, url, options, fileType)
    } catch (ex) {
      logger.error(
        '[HTTP>get]',
        'networks error',
        'url:',
        url,
        'options:',
        options,
        'name:',
        name,
        'fileType:',
        fileType,
        'ex:',
        ex
      )
    }
    if (data && data.body) {
      postData.data = data.body
      if (fileType === 'ts' || fileType === 'video') {
        postData.arrayBuffer = await blob2ArrayBuffer(postData.data)
      }
      if (postData.arrayBuffer) {
        self.postMessage(postData, [postData.arrayBuffer.buffer])
      } else {
        self.postMessage(postData)
      }
    } else {
      postData.type = 'error'
      postData.data = data
      self.postMessage(postData)
    }
  }
}

/**
 * output object of HTTP
 * @usage
 * http.get('url', {})
 * http.post('url', {})
 */
let instance = null
const http = (function() {
  if (!instance) {
    instance = new HTTP({})
  }
  return instance
})()

export default self => {
  self.onmessage = function(event) {
    const data = event.data
    const type = data.type
    const method = data.method
    switch (type) {
      case 'invoke':
        http[method].call(
          http,
          data.url,
          data.options,
          data.name,
          data.fileType
        )
        break
      case 'notice':
        break
      default:
        break
    }
  }
}

// export {
//   http,
//   HTTP
// }
