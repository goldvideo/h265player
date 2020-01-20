/**
 * @copyright: Copyright (C) 2019
 * @desc: events object
 * @author: liuliguo 
 * @file: EventsConfig.js
 */

const Events = {
  ProcessorResetEnd: 'DataProcessorController.processorResetEnd',
  DataProcessorReady: 'DataProcessorController.dataProcessorReady',
  // DecodeResetEnd: 'DecodeController.resetEnd',
  DecodeStartDecode: 'DecodeController.startDecode',
  DecodeFlush: 'DecodeController.flush',
  DecodeDecoded: 'DecodeController.decoded',
  DecodeApppendEnd: 'DecodeController.appendEnd',
  DecodeFlushEnd: 'DecodeController.flushEnd',
  DecodeReady: 'DecodeController.ready',

  DemuxResetEnd: 'DemuxController.resetEnd',
  DemuxStartDemux: 'DemuxController.startDemux',
  DemuxLast: 'DemuxController.last',
  DemuxVideo: 'DemuxController.video',
  DemuxAAC: 'DemuxController.AAC',
  DemuxReady: 'DemuxController.ready',

  ImagePlayerRenderEnd: 'ImagePlayer.renderEnd',
  ImagePlayerWait: 'ImagePlayer.wait',
  ImagePlayerReady: 'ImagePlayer.ready',
  ImagePlayerEnd: 'ImagePlayer.end',
  ImagePlayerBuffeUpdate: 'ImagePlayer.bufferUpdate',

  ControlBarPlay: 'ControlBar.onPlay',
  ControlBarPause: 'ControlBar.onPause',
  ControlBarPauseLoading: 'ControlBar.onPauseLoading',

  LoadDataReadBufferByNo: 'LoadData.readBufferByNo',
  LoadDataReadBuffer: 'LoadData.readBuffer',
  LoadDataRead: 'LoadData.onRead',
  LoadDataSeek: 'LoadData.onSeek',
  LoadDataFirstLoaded: 'LoadData.onFirstLoaded',
  
  LoaderPlayListStart: 'Loader.playlistStart',
  LoaderLoading: 'Loader.onLoading',
  LoaderError: 'Loader.onError',
  LoaderLoaded: 'Loader.onLoaded',
  LoaderUpdateSpeed: 'Loader.updateSpeed',
  LoaderLoadFile: 'Loader.loadFile',
  LoaderPlayListLoaded: 'Loader.playlistLoaded',

  AudioPlayerReady: 'AudioPlayer.MSEReady',
  AudioPlayerDataReady: 'AudioPlayer.dataReady',
  AudioPlayerWait: 'AudioPlayer.wait',
  AudioPlayerEnd: 'AudioPlayer.end',
  AudioPlayerPlaySuccess: 'AudioPlayer.playSuccess',
  AudioPlayerPlayFail: 'AudioPlayer.playFail',

  PlayerMaxPTS: 'DemuxController.maxpts',
  PlayerSeekEnd: 'Player.seekend',
  PlayerSpeedTo: 'Player.speedTo',
  PlayerChangeRate: 'Player.changeRate',
  PlayerChangeSrc:  'Player.changeSrc',
  PlayerPlaying: 'Player.playing',
  PlayerTimeUpdate: 'Player.timeUpdate',
  PlayerbufferUpdate: 'Player.bufferupdate',
  PlayerResetReady: 'Player.resetReady',
  PlayerWait: 'Player.wait',
  PlayerLoadNext: 'Player.loadNext',
  PlayerOnPlay: 'Player.onPlay',
  PlayerOnPause: 'Player.onPause',
  PlayerOnSeek: 'Player.onSeek',
  PlayerOnVolume: 'Player.onVolume',
  PlayerReady: 'Player.ready',
  /**
   * Event handling during player playing
   * @event Player#play
   * @type {Player}
   * 
  */
  PlayerPlay: 'Player.play',
  PlayerReset: 'Player.reset',
  PlayerLoadedMetaData: 'Player.loadedMetaData',
  /**
   * Event handling after playing ends
   * @event Player#end
   * @type {Player}
   * 
  */
  PlayerEnd: 'Player.end',
  /**
   * Event handling when playing pauses
   * @event Player#pause
   * @type {Player}
   * 
  */
  PlayerPause: 'Player.pause',
  /**
   * Event handling when player seeking data
   * @event Player#seeking
   * @type {Player}
   * 
  */
  PlayerSeeking: 'Player.seeking',
  PlayerAlert: 'Player.alert',
  PlayerThrowError: 'Player.throwError',

  StreamDataReady: 'StreamController.dataReady',
}

export default Events