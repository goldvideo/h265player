# Nginx 配置：H.265 播放器支持（最小化版本）

## 最快修复：3 步搞定

### 第 1 步：找到你的 nginx.conf

```bash
# 运行这个命令找到位置
sudo nginx -t

# 通常在以下位置：
/etc/nginx/nginx.conf                    # Linux
/usr/local/etc/nginx/nginx.conf          # macOS Intel
/opt/homebrew/etc/nginx/nginx.conf       # macOS Apple Silicon
```

### 第 2 步：编辑 nginx.conf 的 http 块

在 `http { }` 块中找到 `types { }` 块，添加一行：

```nginx
http {
    include mime.types;
    default_type application/octet-stream;

    # ✅ 添加这一行 ✅
    types {
        application/wasm wasm;
    }

    # 其他配置...
}
```

**或者编辑 mime.types 文件：**

```bash
sudo vim /etc/nginx/mime.types

# 在 types 块中添加这一行（通常在最后面）
application/wasm                 wasm;
```

### 第 3 步：重新加载 Nginx

```bash
# 验证配置无误
sudo nginx -t

# 重新加载配置（不会断开现有连接）
sudo nginx -s reload

# 或者
sudo systemctl reload nginx
```

---

## ✅ 验证修复成功

### 方式 1：使用 curl 检查

```bash
curl -I http://127.0.0.1:8000/h265player/dist/lib/libffmpeg.wasm

# 应该看到这一行：
# Content-Type: application/wasm
```

### 方式 2：打开浏览器 DevTools

1. 按 F12 打开开发者工具
2. 切换到 **Network** 选项卡
3. 刷新页面
4. 找到 `libffmpeg.wasm` 文件
5. 在 **Response Headers** 中检查 `Content-Type`
6. 应该显示：`application/wasm`

---

## 完整的 H.265 专用配置（推荐）

为你的 h265player 创建一个专用的 server 配置。

**创建文件：** `/etc/nginx/conf.d/h265player.conf`

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 修改为你的域名或 IP

    # 项目根目录
    root /path/to/goldvideo/h265player;  # 修改为实际路径
    index index.html;

    # 字符编码
    charset utf-8;

    # ============ WASM 支持（关键）============
    location ~ \.wasm$ {
        add_header Content-Type application/wasm;
        add_header Cache-Control "public, max-age=86400";
    }

    # ============ 启用 Gzip 压缩 ============
    gzip on;
    gzip_types
        text/plain
        text/css
        text/javascript
        application/json
        application/javascript
        application/wasm;

    # ============ 日志 ============
    access_log /var/log/nginx/h265player_access.log;
    error_log /var/log/nginx/h265player_error.log warn;
}
```

**然后重新加载：**
```bash
sudo nginx -t
sudo nginx -s reload
```

---

## 问题排查

| 现象 | 解决方案 |
|------|--------|
| 仍然报 WASM MIME type 错误 | 1. 清理浏览器缓存 (Ctrl+Shift+Del)<br>2. 确认运行了 `nginx -s reload`<br>3. 检查是否编辑了正确的配置文件 |
| nginx 验证失败 (`nginx -t` 报错) | 检查语法，通常是缺少分号或括号 |
| 无法访问页面 | 检查 root 路径是否正确 |

---

## 一条命令快速验证

```bash
# 验证所有关键文件的 Content-Type
echo "=== Checking MIME types ===" && \
curl -sI http://127.0.0.1:8000/h265player/dist/lib/libffmpeg.wasm | grep Content-Type && \
curl -sI http://127.0.0.1:8000/h265player/dist/lib/libffmpeg.js | grep Content-Type && \
curl -sI http://127.0.0.1:8000/h265player/demo/demo-mp4.html | grep Content-Type
```

应该看到：
```
Content-Type: application/wasm
Content-Type: application/javascript (或 text/javascript)
Content-Type: text/html
```

