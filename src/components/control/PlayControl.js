import BaseComponent from '../../base/BaseComponent'
import Element from '../../toolkit/Element'

class PlayControl extends BaseComponent {

    static componentList = ['playButton', 'pauseButton', 'replayButton']

    constructor(options = {}) {
        super(options)
        this.options = Object.assign(this.options, options)
        this.componentsController = this.options.componentsController
        this.init()
    }

    render() {
        const el = Element.createEl('gp-button-block')
        el.classList.add('goldplay__control--button-block')
        PlayControl.componentList.forEach(item => {
            let com = this.componentsController.getComponent(item)
            el.appendChild(com.element)
        })
        this.element = el
    }

    static addCustomControl(name) {
        PlayControl.componentList.push(name)
    }
}

export default PlayControl