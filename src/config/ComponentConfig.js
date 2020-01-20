/**
 * @copyright: Copyright (C) 2019
 * @file ComponentConfig.js
 * @desc
 * component config
 * @author Jarry
 */
import BaseComponent from '../base/BaseComponent'
import Poster from '../components/screen/Poster'
import ControlBarContainer from '../control-bar/Container'
import ProgressBar from '../components/progress/ProgressBar'
import PlayButton from '../components/control/PlayButton'
import PauseButton from '../components/control/PauseButton'
import ReplayButton from '../components/control/ReplayButton'
import VolumeBar from '../components/volume/VolumeBar'
import WaitingBar from '../components/tips/WaitingBar'
import AlertBox from '../components/tips/AlertBox'
import Timer from '../components/timer/Timer'
import SpeedBar from '../components/speed/SpeedBar'
import Subtitle from '../components/subtitle/Subtitle'
import RateBar from '../components/rate/RateBar'
import SettingBar from '../components/setting/SettingBar'
import FullPage from '../components/fullscreen/FullPage'
import FullScreen from '../components/fullscreen/FullScreen'
import BigPlayButton from '../components/control/BigPlayButton'
import PlayControl from '../components/control/PlayControl'
import SideControlBar from "../control-bar/SideControlBar";
import NearControlBar from "../control-bar/NearControlBar";

const CONPONENTS_MAP = {
  BaseComponent: BaseComponent,
  controlBarContainer: ControlBarContainer,
  bigPlayButton: BigPlayButton,
  poster: Poster,
  progressBar: ProgressBar,
  playButton: PlayButton,
  pauseButton: PauseButton,
  replayButton: ReplayButton,
  volumeBar: VolumeBar,
  waitingBar: WaitingBar,
  alertBox: AlertBox,
  timer: Timer,
  speedBar: SpeedBar,
  subtitle: Subtitle,
  rateBar: RateBar,
  settingBar: SettingBar,
  fullPage: FullPage,
  fullScreen: FullScreen,
  playControl: PlayControl,
  sideControlBar: SideControlBar,
  nearControlBar: NearControlBar
}

export { CONPONENTS_MAP }
