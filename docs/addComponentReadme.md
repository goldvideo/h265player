# 注册新组件

1、获取组件基类`BaseComponent`

```shell
const BaseComponent = GoldPlay.getComponent('BaseComponent')
```

2、定义自己的组件类，该类继承`BaseComponent`

```shell
class ButtonComponent extends BaseComponent { ... }
```

3、注册组件到`GoldPlay`，显示在control bar右侧第二个位置

```shell
GoldPlay.registerComponent('buttonComponent', ButtonComponent, 'right', 1)
```

4、为使新组件的初始化属性函数、绑定事件函数等生效，需要在新组件中定义`registerMethod`方法，在该方法中调用要生效的函数

```shell
registerMethod() {

  this.initProps()

  this.bindEvent()

}
```