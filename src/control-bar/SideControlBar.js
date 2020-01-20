import BaseComponent from '../base/BaseComponent'
import Element from '../toolkit/Element'

class SideControlBar extends BaseComponent {

    static componentList = ['speedBar', 'rateBar', 'volumeBar', 'fullPage', 'fullScreen']

    constructor(options = {}) {
        super(options)
        this.options = Object.assign(this.options, options)
        this.componentsController = this.options.componentsController
        this.init()
    }

    render() {
        const el = Element.createEl('gp-control-sidebar')
        el.classList.add('goldplay__control--sidebar')
        SideControlBar.componentList.forEach(item => {
            let com = this.componentsController.getComponent(item)
            el.appendChild(com.element)
        })
        this.element = el
    }

    static addCustomControl(name, index) {
        if(index < 0 || index > SideControlBar.componentList.length) {
            index = SideControlBar.componentList.length
        }
        SideControlBar.componentList.splice(index, 0, name)
    }
}

export default SideControlBar