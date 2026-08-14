# 阿里云轻量应用服务器部署

本文档用于将个人版姿序训练应用部署到 Ubuntu 24.04 轻量应用服务器。服务仅监听本机 `127.0.0.1:8787`，公网流量统一通过 Nginx 和 HTTPS 进入。

## 生产环境变量

在 `/etc/posture-training/posture-training.env` 中设置：

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=8787
DATABASE_FILE=/var/lib/posture-training/app.sqlite
UPLOAD_DIR=/var/lib/posture-training/uploads
COOKIE_SECRET=使用 openssl rand -hex 32 生成
ALLOWED_ORIGINS=https://liang111.top,https://www.liang111.top,capacitor://localhost,http://localhost,https://localhost
```

该文件权限应为 `600`，数据目录权限应仅授予运行服务的 `admin` 用户。

## 部署结构

- 代码与前端产物：`/opt/posture-training`
- SQLite 和照片：`/var/lib/posture-training`
- 环境变量：`/etc/posture-training/posture-training.env`
- systemd：`/etc/systemd/system/posture-training.service`
- Nginx：`/etc/nginx/sites-available/liang111.top`

首次上线时，必须先在仅本机可访问的 API 上创建唯一用户，再启用公网 Nginx，避免其他人抢先完成首次设置。

## 上线后检查

```bash
systemctl status posture-training --no-pager
curl -fsS http://127.0.0.1:8787/api/health
nginx -t
curl -I https://liang111.top
```

首页底部必须保留 ICP 备案号及工信部链接。公安联网备案通过后，再加入公安备案图标、编号和官方查询链接。
