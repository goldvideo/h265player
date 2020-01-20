import BaseComponent from '../base/BaseComponent'
import Element from '../toolkit/Element'

class NearControlBar extends BaseComponent {

    static componentList = ['playControl', 'timer']

    constructor(options = {}) {
        super(options)
        this.options = Object.assign(this.options, options)
        this.componentsController = this.options.componentsController
        this.init()
    }

    render() {
        const el = Element.createEl('gp-control-nearside')
        el.classList.add('goldplay__control--button-block')
        NearControlBar.componentList.forEach(item => {
            let com = this.componentsController.getComponent(item)
            el.appendChild(com.element)
        })
        this.element = el
    }

    static addCustomControl(name, index) {
        if(index < 0 || index > NearControlBar.componentList.length) {
            index = NearControlBar.componentList.length
        }
        NearControlBar.componentList.splice(index, 0, name)
    }
}

export default NearControlBar