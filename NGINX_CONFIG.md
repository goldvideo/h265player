# Nginx 配置：为 H.265 播放器支持 WASM 文件

## 方案 1: 在现有 nginx.conf 中添加 MIME types

找到你的 nginx.conf（通常位置）:
- `/etc/nginx/nginx.conf`
- `/usr/local/etc/nginx/nginx.conf` (macOS)
- `/opt/homebrew/etc/nginx/nginx.conf` (M1/M2 Mac)

### 编辑方法 A: 在 types 块中添加

在 `http { }` 块中找到 `types { }` 块，添加 WASM 类型：

```nginx
http {
    include mime.types;
    default_type application/octet-stream;

    # 添加这一行来支持 WASM 文件
    types {
        application/wasm wasm;
    }

    # 其他 nginx 配置...
}
```

### 完整的配置示例

创建或编辑 `/etc/nginx/nginx.conf`：

```nginx
user nobody;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include mime.types;
    default_type application/octet-stream;

    # 为 WASM 文件添加正确的 MIME type
    types {
        application/wasm wasm;
    }

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss
               application/rss+xml application/atom+xml image/svg+xml
               text/x-component text/x-cross-domain-policy
               application/wasm;  # 也要在 gzip_types 中添加 WASM

    # 引入服务器配置
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```

---

## 方案 2: 在 server 块中配置（针对单个域名）

如果你只想为特定的服务器配置，编辑 `/etc/nginx/conf.d/default.conf` 或 `/etc/nginx/sites-available/your-site`：

```nginx
server {
    listen 80;
    server_name localhost;

    # 项目根目录
    root /path/to/goldvideo/h265player;
    index index.html;

    # 为 WASM 文件设置正确的 MIME type 和缓存
    location ~ \.wasm$ {
        add_header Content-Type application/wasm;
        add_header Cache-Control "public, max-age=31536000, immutable";
        expires 365d;
    }

    # 为 JS 文件设置 Content-Type（可选但推荐）
    location ~ \.js$ {
        add_header Content-Type application/javascript;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # 其他资源缓存设置
    location ~ \.(html|css|json)$ {
        add_header Cache-Control "public, max-age=3600";
    }

    # 启用 gzip 压缩
    gzip on;
    gzip_types application/wasm application/javascript text/css text/plain;
    gzip_min_length 1024;

    # 处理 SPA 路由（如果需要）
    try_files $uri $uri/ /index.html;
}
```

---

## 方案 3: 创建单独的 mime.types 文件扩展

创建 `/etc/nginx/mime.types.d/wasm.types`：

```nginx
types {
    application/wasm wasm;
}
```

然后在 nginx.conf 中引入：

```nginx
http {
    include mime.types;
    include /etc/nginx/mime.types.d/*.types;

    # 其他配置...
}
```

---

## 完整的 H.265 播放器 Nginx 配置

为你的 h265player 项目创建专用配置。编辑或创建 `/etc/nginx/conf.d/h265player.conf`：

```nginx
upstream h265_backend {
    server localhost:9000;  # 如果有后端 API
}

# HTTP 重定向到 HTTPS（可选）
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS 配置
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书配置（可选）
    # ssl_certificate /path/to/cert.pem;
    # ssl_certificate_key /path/to/key.pem;

    root /path/to/goldvideo/h265player;
    index index.html index.htm;

    # 字符编码
    charset utf-8;
    source_charset utf-8;

    # ============ 关键：WASM 支持 ============
    # 为 WASM 文件添加正确的 MIME type
    location ~ \.wasm$ {
        add_header Content-Type application/wasm;
        # 不要在浏览器中缓存过久，但可以在 CDN 缓存
        add_header Cache-Control "public, max-age=86400";
        # CORS 支持（如果需要跨域）
        add_header Access-Control-Allow-Origin "*";
    }

    # ============ 其他静态资源 ============
    location ~ \.(js|css|svg|png|jpg|jpeg|gif|ico|webp)$ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        expires 365d;
    }

    location ~ \.(html|json)$ {
        add_header Cache-Control "public, max-age=3600";
        expires 1h;
    }

    # ============ 日志和错误处理 ============
    access_log /var/log/nginx/h265player_access.log;
    error_log /var/log/nginx/h265player_error.log warn;

    # ============ 性能优化 ============
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml
        application/wasm;  # 重要：启用 WASM 压缩

    # ============ SPA 路由支持 ============
    location / {
        try_files $uri $uri/ /index.html;
    }

    # ============ 禁用访问某些文件 ============
    location ~ /\. {
        deny all;
    }

    location ~ /node_modules {
        deny all;
    }
}
```

---

## 快速应用步骤

### 1️⃣ 找到 nginx 配置文件

```bash
# 查找 nginx.conf 位置
sudo nginx -t

# 输出会显示配置文件路径，比如：
# nginx: the configuration file /etc/nginx/nginx.conf test is successful
```

### 2️⃣ 编辑配置文件

**方案 A：直接修改 nginx.conf**
```bash
sudo vim /etc/nginx/nginx.conf

# 在 http { } 块中找到 types { } 块，添加：
types {
    application/wasm wasm;
}
```

**方案 B：创建新的配置文件（推荐）**
```bash
sudo vim /etc/nginx/conf.d/h265player.conf

# 复制上面"完整的 H.265 播放器 Nginx 配置"的内容
# 修改 root 路径和 server_name
```

### 3️⃣ 修改 mime.types 文件

如果 nginx.conf 中没有 types 块，编辑 `/etc/nginx/mime.types`：

```bash
sudo vim /etc/nginx/mime.types

# 在合适的位置添加（通常在 types 块中）：
types {
    # ... 其他类型 ...
    application/wasm                 wasm;
}
```

### 4️⃣ 验证配置

```bash
# 测试配置是否有效
sudo nginx -t

# 应该看到：
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 5️⃣ 重启 Nginx

```bash
# 方案 A：重启（会断开现有连接）
sudo systemctl restart nginx

# 方案 B：热重载（不断开现有连接，推荐）
sudo nginx -s reload

# 或使用
sudo systemctl reload nginx
```

### 6️⃣ 验证 MIME type 是否生效

```bash
# 测试 WASM 文件的 Content-Type
curl -I http://your-domain.com/h265player/dist/lib/libffmpeg.wasm

# 应该看到：
# HTTP/1.1 200 OK
# Content-Type: application/wasm
# Cache-Control: public, max-age=86400
```

---

## 完整检查清单

- [ ] 找到 nginx.conf 位置
- [ ] 修改配置文件，添加 WASM MIME type
- [ ] 运行 `sudo nginx -t` 验证配置
- [ ] 运行 `sudo nginx -s reload` 重启 Nginx
- [ ] 用 curl 或浏览器验证 `.wasm` 文件的 Content-Type
- [ ] 刷新浏览器测试播放器
- [ ] 检查浏览器 DevTools → Network → 找 libffmpeg.wasm → 检查 Response Headers

---

## 常见问题

**Q: 修改后还是不生效？**

A: 检查几点：
1. 是否保存了文件
2. 是否运行了 `sudo nginx -s reload`
3. 是否清理了浏览器缓存（Ctrl+Shift+Delete）
4. 是否检查了正确的 nginx.conf 文件（用 `nginx -t` 确认）

**Q: 多个服务器块如何配置？**

A: 在每个 server 块中都添加 `location ~ \.wasm$ { ... }` 块

**Q: 性能影响？**

A:
- WASM 文件可以启用 gzip 压缩（会减小体积 80%+）
- 可以在浏览器中缓存（加 Cache-Control header）
- 建议配合 CDN 使用

