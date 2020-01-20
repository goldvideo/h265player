const goldplay = require('../dist/goldplay-h265-sdk')
import BaseClass  from '../src/base/BaseClass'
import LoaderController from '../src/loader/LoaderController'
import BaseController  from '../src/base/BaseController'

jest.mock('../src/base/BaseClass')
jest.mock('../src/loader/LoaderController')
jest.mock('../src/base/BaseController')

beforeEach(() => {
  // Clear all instances and calls to constructor and all methods:
  BaseClass.mockClear()
  LoaderController.mockClear()
  BaseController.mockClear()
})

test('GoldPlay is a Object', () => {
  console.log('goldplay:', goldplay)
  expect(goldplay instanceof Object).toBe(true)
})

test('BaseController is a Class', () => {
  console.log('BaseController:', BaseController)
  expect(typeof BaseController !== 'undefined').toBe(true)
})

test('LoaderController is a Class', () => {
  const loaderController = new LoaderController()
  console.log('loaderController.run:', loaderController.run)
  expect(typeof loaderController.run === 'function').toBe(true)
})

test('HLS loader test', () => {
  // async loadTest$() {
  //   const url = 'http://10.123.19.95/goldplay/tsdata/h265/playlist.m3u8'

  //   this.logger.error('loadTest', 'this.logger.error', this)
  //   throwError('ThrowError错误测试')

  //   http.get(url).then(response => {
  //     this.logger.log('initLoad', 'http.get', 'response', response, 'arguments', arguments)
  //     console.log('http.get(url).then(response):', response)
  //   })

  //   let res = http.syncRequest(url)
  //   res.then( text => {
  //     console.log('let res = http.syncRequest(url) res.the(text):', text)
  //   })

  //   let result = await http.get(url)
  //   console.log('let result = await http.get(url):', result)

  //   console.log('this.segmentPool:', this.segmentPool)
  //   // 二分查找单个符合区间的时间
  //   console.log('this.segmentPool.getByTime(1785):', this.segmentPool.getByTime(1785))
  //   console.log('25this.segmentPool.indexOfByTime(22585)', this.segmentPool.indexOfByTime(22585))
  //   // 符合任一区间即可提取对象，逐个遍历查询
  //   console.log('[102.24, 11.2, 234.3, 45.56]:this.segmentPool.getBy((item)):', this.segmentPool.getBy((item) => {
  //     let times = [102.24, 11.2, 234.3, 45.56]
  //     let res = false
  //     times.forEach( (time) => {
  //       if (time >= item.start && time < item.end) {
  //         res = true
  //         return
  //       }
  //     })
  //     return res
  //   }))

  //   console.log('this.segmentPool.toJSON()', this.segmentPool.toJSON())

  // }
})

  /* loaderController */
  // async test$() {

  //   console.error('Loader:run', '执行:', this.exeLoader, this.loadData)
  //   // 测试事件监听与回调, 一次只允许读取一次，只有读完回调之后才允许再次读取

  //   dataController('load').getDataInstance().readBufferByNo(5, (data) => {
  //     // 1.
  //     console.log('LoadData.readBufferByNo:call', this.getLoadData().isBufferReading, data, 5)

  //     dataController('load').getDataInstance().readBufferByNo(26, (data) => {
  //       console.log('LoadData.readBufferByNo:call', this.getLoadData().isBufferReading, data, 6)

  //       dataController('load').getDataInstance().readBufferByNo(7, (data) => {
  //         console.log('LoadData.readBufferByNo:call', this.getLoadData().isBufferReading, data, 7)
  //       })

  //       dataController('load').getDataInstance().readBufferByNo(17, (data) => {
  //         console.log('LoadData.readBufferByNo:call', this.getLoadData().isBufferReading, data, 17)
  //       })
  //     })

  //     window.dataController = dataController
  //   })
  // }

  /* loaderController */

  // bindEvent() {
  //   this.logger.info('bindEvent', '测试on事件', 'events:', events, this)
  //   let self = this
  //   this.events.on('Loader.emitEvent', function() {
  //     logger.log('on Loader.emitEvent:', 'Loader 事件绑定回调', this, arguments)
  //     //这里this指向调用者
  //     self.emitEvent()
  //   })
  //   // 再绑定一次测试
  //   this.events.on('Loader.emitEvent', self.emitEvent)
  // }

  // emitEvent(setting) {
  //   this.logger.info('Loader.emitEvent', '测试emit事件执行', this)
  // }
