/**
 * @copyright: Copyright (C) 2019
 * @file LoaderConfig.js
 * @desc
 * loader config
 * @author Jarry
 */

const error = {
  dispatch: () => {},
  load:  () => {},
  read:  () => {},
  memory:  () => {},
}

const state = {
  LOAD_PLAYLIST: 10,
  get '10' () {
    return 'loading playlist'
  },
  LOADED_PLAYLIST: 11,
  get '11' () {
    return 'playlist is loaded'
  },
  IDLE: 0,
  get '0' () {
    return 'is free'
  },
  LOADING: 1,
  get '1' () {
    return 'loading segment'
  },
  DONE: 2,
  get '2' () {
    return 'segment is loaded'
  },
  ERROR: 3,
  get '3' () {
    return 'load get error'
  }
}

export {
  state,
  error
}