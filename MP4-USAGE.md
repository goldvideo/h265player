# MP4 播放支持 - 使用指南

## 概述

本版本在原有HLS协议支持的基础上，新增了MP4文件格式的完整支持。播放器会自动检测媒体类型，无需修改现有HLS代码。

## 快速开始

### 基础用法

```javascript
// 播放MP4文件
const player = new GoldPlay(document.getElementById('player'), {
    sourceURL: 'https://example.com/video.mp4',
    type: 'MP4',
    libPath: './dist/lib/',
    autoPlay: true
});
```

### 播放HLS（原有方式）

```javascript
// HLS播放保持不变
const player = new GoldPlay(document.getElementById('player'), {
    sourceURL: 'https://example.com/stream.m3u8',
    type: 'HLS',
    libPath: './dist/lib/'
});
```

## 配置选项

### MP4专用配置

```javascript
const options = {
    // 基础配置
    sourceURL: 'path/to/video.mp4',      // MP4文件URL
    type: 'MP4',                          // 指定为MP4格式
    libPath: './dist/lib/',              // 解码器库路径

    // 播放控制
    autoPlay: true,                       // 自动播放
    preload: true,                        // 预加载元数据
    startTime: 0,                         // 起始位置（秒）

    // 界面配置
    poster: 'path/to/poster.jpg',        // 封面图片
    controlBarAutoHide: true,            // 自动隐藏控制条
    controlBarAutoHideTime: 3,           // 自动隐藏延迟（秒）

    // 缓冲配置
    maxBufferLength: 5000,               // 最大缓冲时长（毫秒）

    // 高级配置
    processURL: (url, segment) => url   // URL处理函数
};

let player = new GoldPlay(container, options);
```

## 支持的格式

### 视频编码
- **H.265/HEVC** - 主要支持格式
- **H.264** - 取决于浏览器支持

### 音频编码
- **AAC** - 主要支持格式
- **其他** - 需要浏览器原生支持

### 容器格式
- **MP4** - 标准MP4容器（推荐）
- **MOV** - MOV格式（兼容MP4）
- **M4V** - iTunes视频格式

## 工作原理

```
MP4文件 (video.mp4)
    ↓
[MP4Loader] 加载文件头，获取元数据
    ↓
[MP4Parser] 解析moov box，提取：
    ├─ 视频时长、分辨率
    ├─ 轨道信息（视频、音频）
    └─ 构建分片索引
    ↓
[SegmentPool] 根据时间创建分片（2秒/分片）
    ↓
[MP4DataManage] 管理缓冲和分片加载
    ↓
[MP4Loader.loadFile()] 加载指定分片
    ↓
[MP4Demux] 解复用为音视频流
    ↓
[Decoder] H.265视频解码 + AAC音频解码
    ↓
[ImagePlayer] Canvas渲染 + [AudioPlayer] Web Audio播放
    ↓
同步音视频输出
```

## API 文档

### 播放控制

```javascript
// 播放/暂停
player.play()                    // 开始播放
player.pause()                   // 暂停播放
player.stop()                    // 停止并重置

// 音量控制
player.setVolume(0.5)           // 设置音量（0-1）
player.muted = true             // 静音

// 速度控制
player.setPlaybackRate(1.5)     // 设置播放速度（0.5x - 3x）

// 搜索
player.seeking(30)              // 跳转到30秒位置
```

### 信息获取

```javascript
// 时间信息
player.duration                 // 总时长（秒）
player.currentTime              // 当前位置（秒）

// 状态查询
player.paused                   // 是否暂停
player.ended                    // 是否播放完成
player.seeking                  // 是否正在搜索

// 缓冲信息
player.buffer()                 // 获取缓冲范围 [start, end]
player.buffered                 // 缓冲对象
```

### 媒体切换

```javascript
// 切换MP4
player.switchURL('new-video.mp4')

// 切换HLS
player.switchURL('stream.m3u8')

// 切换清晰度（支持多个M3U8列表）
player.switchPlaylist('hd.m3u8')
```

### 事件监听

```javascript
// 播放事件
player.events.on('play', () => {
    console.log('播放开始');
});

player.events.on('pause', () => {
    console.log('播放暂停');
});

player.events.on('seek', (time) => {
    console.log('搜索到:', time);
});

player.events.on('ended', () => {
    console.log('播放结束');
});

// 错误事件
player.events.on('error', (error) => {
    console.error('播放错误:', error);
});

player.events.on('alert', (message) => {
    console.warn('警告:', message);
});

// 加载事件
player.events.on('loadstart', () => {
    console.log('开始加载');
});

player.events.on('loadend', () => {
    console.log('加载完成');
});
```

## 文件要求

### MP4文件结构

MP4文件需要满足以下要求：

```
MP4文件结构：
┌─ ftyp box (文件类型)
├─ mdat box (媒体数据) [可选，在moov之前或之后]
├─ moov box (元数据) ← 重要
│  ├─ mvhd (视频头)
│  ├─ trak (视频轨道)
│  │  ├─ tkhd (轨道头)
│  │  ├─ edts (编辑列表)
│  │  ├─ mdia (媒体容器)
│  │  │  ├─ mdhd (媒体头)
│  │  │  ├─ hdlr (处理器)
│  │  │  └─ minf (媒体信息)
│  │  │     ├─ smhd/vmhd (音频/视频头)
│  │  │     └─ stbl (样本表)
│  │  │        ├─ stsd (样本描述)
│  │  │        ├─ stts (时间-样本映射)
│  │  │        ├─ stss (同步样本)
│  │  │        ├─ stsc (样本-分片映射)
│  │  │        ├─ stsz (样本大小)
│  │  │        └─ stco/co64 (块位置)
│  │  └─ ...其他轨道
│  └─ ...其他box
└─ mdat box (媒体数据) [如果在moov之前]
```

**重点：**
- ✅ moov box应在文件头部（推荐在mdat之前）
- ✅ 包含有效的视频轨道（vide类型）
- ✅ 可选但推荐：包含音频轨道（soun类型）
- ✅ 有效的时间戳（PTS/DTS）
- ✅ 关键帧标记（stss box）

### 服务器配置

MP4文件需要正确的HTTP头部：

```
HTTP/1.1 200 OK
Content-Type: video/mp4
Content-Length: 12345678
Accept-Ranges: bytes              # 重要：支持范围请求
Access-Control-Allow-Origin: *    # 重要：CORS支持
Cache-Control: public, max-age=3600

[视频数据...]
```

### 视频编码要求

**推荐配置：**
```
视频编码: H.265 (HEVC)
分辨率: 720p 或更高
帧率: 24fps 或更高
比特率: 2-5 Mbps

音频编码: AAC
采样率: 44.1 kHz 或 48 kHz
比特率: 128-256 kbps
```

## 完整示例

### HTML页面

```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="./dist/goldplay-h265.css">
</head>
<body>
    <div id="player"></div>

    <script src="./dist/goldplay-h265-sdk.js"></script>
    <script>
        const player = new GoldPlay(
            document.getElementById('player'),
            {
                sourceURL: 'https://example.com/video.mp4',
                type: 'MP4',
                libPath: './dist/lib/',
                autoPlay: true,
                poster: 'https://example.com/poster.jpg'
            }
        );

        // 监听事件
        player.events.on('play', () => console.log('播放'));
        player.events.on('pause', () => console.log('暂停'));
        player.events.on('error', (e) => console.error('错误', e));
    </script>
</body>
</html>
```

### 动态切换媒体

```javascript
// 当前播放MP4
player.switchURL('video1.mp4');

// 切换到另一个MP4
setTimeout(() => {
    player.switchURL('video2.mp4');
}, 10000);

// 切换到HLS流
setTimeout(() => {
    player.switchURL('stream.m3u8');
}, 20000);
```

## 代码架构

新增组件：

```
src/
├── toolkit/
│   └── MP4Parser.js             # MP4元数据解析器
│       ├─ parse()               # 解析MP4头
│       ├─ extractMetadata()     # 提取元数据
│       ├─ buildSegmentIndex()   # 构建分片索引
│       └─ getSegmentByTime()    # 时间查询分片
│
├── loader/
│   └── MP4Loader.js             # MP4加载器
│       ├─ preload()             # 预加载元数据
│       ├─ loadFile()            # 加载分片
│       └─ handlePreloadResponse() # 处理加载响应
│
├── demux/
│   └── MP4Demux.js              # MP4解复用器
│       ├─ push()                # 推入数据
│       ├─ demuxed()             # 处理解复用数据
│       └─ getVideoData/AudioData() # 获取媒体流
│
└── data-processor/
    └── dataProcessor.js         # 更新支持MP4
        └─ mediaType参数         # 识别媒体类型
```

## 常见问题

### Q: MP4和HLS的主要区别是什么？

**A:**
- **HLS：** 流媒体协议，文件分为多个.ts分片，通过.m3u8播放列表组织
- **MP4：** 单一文件，所有数据在一个文件中，支持随机访问

### Q: 如何检测自动选择MP4还是HLS？

**A:**
```javascript
// 自动检测
const url = 'video.mp4';
const type = url.endsWith('.mp4') ? 'MP4' : 'HLS';

const player = new GoldPlay(container, {
    sourceURL: url,
    type: type
});
```

### Q: MP4支持什么编解码器？

**A:**
- ✅ H.265 (HEVC) - 主要支持
- ✅ H.264 - 依赖浏览器
- ✅ AAC - 音频主要格式
- ❌ VP9, AV1 等 - 暂不支持

### Q: 可以在HLS和MP4之间切换吗？

**A:** 可以！使用 `switchURL()` 方法：
```javascript
player.switchURL('video.mp4');  // 切换到MP4
player.switchURL('stream.m3u8'); // 切换到HLS
```

### Q: MP4文件需要多大？

**A:**
- 单个MP4文件可以很大（GB级别）
- 播放器自动分片加载，无需完整下载
- 建议使用HTTP Range请求来优化

### Q: 旧代码需要修改吗？

**A:** 不需要！
- 所有改动都向后兼容
- HLS代码保持不变
- 只需在选项中指定 `type: 'MP4'`

## 浏览器兼容性

| 浏览器 | 版本 | 支持度 |
|--------|------|--------|
| Chrome | 57+ | ✅ 完全支持 |
| Firefox | 52+ | ✅ 完全支持 |
| Safari | 11+ | ✅ 完全支持 |
| Edge | 79+ | ✅ 完全支持 |
| IE | - | ❌ 不支持 |

**必要条件：**
- WebAssembly (WASM) 支持
- Canvas 2D 支持
- Web Audio API 支持
- ArrayBuffer 和 TypedArray 支持

## 性能优化建议

### 1. 预加载优化
```javascript
// 只预加载元数据，延迟媒体加载
const player = new GoldPlay(container, {
    sourceURL: 'video.mp4',
    preload: true,      // 仅加载元数据
    autoPlay: false     // 延迟播放
});
```

### 2. 缓冲优化
```javascript
// 根据网络状况调整缓冲
const player = new GoldPlay(container, {
    maxBufferLength: 10000  // 增加缓冲以减少卡顿
});
```

### 3. 网络优化
- 使用CDN分发MP4文件
- 启用HTTP Keep-Alive
- 配置合适的分片大小（默认2秒）

## 故障排除

### 问题：播放器无法加载MP4

**检查清单：**
```javascript
✓ 确认URL正确：player.options.sourceURL
✓ 检查type设置：type: 'MP4'
✓ 验证CORS：Access-Control-Allow-Origin头
✓ 查看浏览器控制台错误消息
✓ 确认MP4文件有效
```

### 问题：音视频不同步

**检查清单：**
```javascript
✓ 确认MP4有有效的PTS/DTS时间戳
✓ 检查网络延迟
✓ 验证音频编码为AAC
✓ 查看decode日志
```

### 问题：无法seek跳转

**检查清单：**
```javascript
✓ 确认服务器支持Range请求
✓ 检查MP4有stss（关键帧）box
✓ 验证Accept-Ranges header存在
✓ 查看loader日志
```

## 更新日志

### v1.1.0 (当前版本)
- ✨ 新增MP4文件支持
- ✨ 自动协议检测
- ✨ MP4Parser元数据解析
- ✨ 支持HTTP Range请求
- 🔧 dataProcessor支持多种媒体类型
- 📝 完整文档和测试例子

### v1.0.x
- 支持HLS直播流
- H.265/HEVC解码
- Web Audio音频播放

## 许可证

ISC

## 支持和反馈

如有问题或建议，请：
1. 查看浏览器控制台错误日志
2. 检查此文档的故障排除部分
3. 提交GitHub Issue
4. 联系技术支持

---

**最后更新：** 2021年
**维护者：** GoldVideo Team
