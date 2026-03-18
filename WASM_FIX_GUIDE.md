# H.265 播放器 WASM 配置修复指南

## 问题诊断

你遇到的错误都源于一个根本问题：**HTTP 服务器未正确配置 .wasm 文件的 MIME type**

### 错误信息解读

```
wasm streaming compile failed: TypeError: Failed to execute 'compile' on 'WebAssembly':
Incorrect response MIME type. Expected 'application/wasm'.
```

这表示服务器返回了错误的 Content-Type，通常是：
- `text/plain`
- `application/octet-stream`
- 或其他非 `application/wasm` 的类型

后续的 MP4Demux 和 HEVC 错误都是由此引发的连锁反应。

---

## 快速修复方案

### 方案 1: 使用 Python 服务器（推荐）

最简单的方式，无需额外依赖：

```bash
# 进入项目根目录
cd /Users/jarry/github/goldvideo/h265player

# 运行 Python 服务器
python3 server.py

# 然后访问: http://127.0.0.1:8000/h265player/demo/demo-mp4.html
```

### 方案 2: 使用 Node.js 服务器

如果已安装 Node.js：

```bash
# 全局安装 http-server（带 MIME type 支持的版本）
npm install -g http-server

# 进入项目根目录运行
cd /Users/jarry/github/goldvideo/h265player
http-server -p 8000 -c-1

# 或使用我们提供的 Express 服务器
npm install express
node server.js
```

### 方案 3: 使用 Webpack Dev Server（开发最佳选择）

```bash
# 已在 webpack 配置中启用 devServer
cd /Users/jarry/github/goldvideo/h265player

# 直接运行
npm run dev

# 自动打开 http://127.0.0.1:8000
```

---

## 验证修复

### 1. 检查 Network 选项卡
打开浏览器 DevTools → Network 选项卡，刷新页面：
- ✅ **正确**：`libffmpeg.wasm` 的 Response Headers 中应该有：
  ```
  Content-Type: application/wasm
  ```
- ❌ **错误**：如果显示 `text/plain` 或其他类型，说明还需要修复

### 2. 检查 Console 输出
刷新页面，查看 Console：
- ✅ **成功修复**：应该看到类似日志
  ```
  [HTTP] MP4 file loaded: {blobSize: 262144, arrayBufferSize: 262144}
  [MP4Demux] MP4Box available, creating file instance
  ```
- ❌ **未修复**：仍然看到 WASM 错误

### 3. 检查播放功能
- ✅ **修复成功**：H.265 视频能正常播放
- ❌ **未成功**：仍然有黑屏或错误提示

---

## 深度诊断（如果还有问题）

### 检查当前服务器响应
在 Network 选项卡中点击 `.wasm` 文件，查看 Response Headers：

```bash
# 或在终端运行
curl -I http://127.0.0.1:8000/h265player/dist/lib/libffmpeg.wasm

# 应该看到：
# HTTP/1.1 200 OK
# Content-Type: application/wasm
```

### 检查所有关键文件
```bash
curl -I http://127.0.0.1:8000/h265player/dist/lib/libffmpeg.js
curl -I http://127.0.0.1:8000/h265player/dist/lib/libffmpeg.wasm
curl -I http://127.0.0.1:8000/h265player/dist/lib/mp4box.iife.js
```

所有 `.wasm` 文件应该返回 `application/wasm`，`.js` 文件应该返回 `application/javascript` 或 `text/javascript`。

---

## 完整的 HTTP 服务器配置参考

### Nginx 配置示例
```nginx
server {
    listen 8000;
    server_name localhost;

    location / {
        root /Users/jarry/github/goldvideo/h265player;
        autoindex on;
    }

    # 确保 .wasm 文件有正确的 MIME type
    location ~ \.wasm$ {
        add_header Content-Type application/wasm;
    }
}
```

### Apache 配置示例
在 `.htaccess` 或 httpd.conf 中添加：
```apache
AddType application/wasm .wasm
```

---

## 预期的诊断输出

修复成功后，Browser Console 应该显示：

```
[HTTP] MP4 file loaded: {blobSize: 262144, arrayBufferSize: 262144}
wasm loaded
[MP4Demux] MP4Box available, creating file instance
[MP4Demux] MP4Box file created: {chunked: false}
[MP4Demux] onReady called with info: {videoTracks: [...], audioTracks: [...]}
[MP4Demux] Found video trak: {...}
[MP4Demux] Setting extraction options for video track
[MP4Demux] Calling start()
```

**没有 WASM 错误！**

---

## 故障排除

| 问题 | 原因 | 解决方案 |
|------|------|--------|
| 仍然显示 WASM MIME type 错误 | 服务器配置未生效 | 1. 清理浏览器缓存 2. 重启服务器 3. 检查是否用了错误的服务器 |
| 404 错误找不到 .wasm 文件 | 文件路径不对或未编译 | 检查 `dist/lib/` 目录是否存在相关文件 |
| 其他 JavaScript 错误 | 浏览器版本过旧 | 使用现代浏览器 (Chrome 50+, Firefox 48+, Safari 11+) |

