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
- Nginx 全局限流：`/etc/nginx/conf.d/posture-security.conf`
- 自动备份：`/usr/local/sbin/posture-backup`、`posture-backup.timer`

首次上线时，必须先在仅本机可访问的 API 上创建唯一用户，再启用公网 Nginx，避免其他人抢先完成首次设置。

## 上线后检查

```bash
systemctl status posture-training --no-pager
curl -fsS http://127.0.0.1:8787/api/health
nginx -t
curl -I https://liang111.top
```

首页底部必须保留 ICP 备案号及工信部链接。公安联网备案通过后，再加入公安备案图标、编号和官方查询链接。

## 安全基线

生产服务器执行以下基线，不把应用端口直接暴露到公网：

- UFW 默认拒绝入站，只放行 `22/tcp`、`80/tcp`、`443/tcp`；应用仅监听 `127.0.0.1:8787`。
- SSH 仅允许 `admin` 通过密钥登录；禁止 root、密码登录、X11、端口转发和隧道。
- Fail2ban 监控 `sshd`，10 分钟内失败 5 次后通过 UFW 封禁 1 小时。
- 登录与首次设置接口按来源 IP 限制为每分钟 5 次；其余 API 为每秒 20 次并限制并发连接。
- HTTPS 响应发送 HSTS、CSP、`nosniff`、禁止嵌入和最小权限策略；API 额外发送 `Cache-Control: no-store`。
- systemd 服务采用只读系统、独立临时目录、空 capability 集合、禁止命名空间和内核参数访问等沙箱限制。
- 数据库权限为 `600`，上传目录权限为 `700`，服务环境文件权限为 `600`。
- 会话仅保存在服务内存中，有效期 7 天，最多保留 100 个；服务重启会使现有登录失效。
- `unattended-upgrades` 自动安装安全更新；云厂商锁定的 `cloud-init` 不应擅自解除 hold。

对应的可审计配置都保存在 `deploy/`：

```text
deploy/nginx-liang111.conf
deploy/nginx-posture-security.conf
deploy/posture-training.service
deploy/sshd-posture-hardening.conf
deploy/fail2ban-posture.local
deploy/posture-backup
deploy/posture-backup.service
deploy/posture-backup.timer
```

修改 SSH 配置前必须保持一个已验证的密钥会话，并先执行 `sshd -t`。修改 Nginx 前先执行 `nginx -t`。修改 systemd 后执行 `systemctl daemon-reload`、重启服务并检查健康接口；任何一步失败都应立即恢复修改前的配置。

## 备份与恢复验证

`posture-backup.timer` 每天约 03:20 运行，使用 SQLite 在线备份生成 root 专属归档并保留 14 天：

```bash
sudo systemctl status posture-backup.timer --no-pager
sudo systemctl start posture-backup.service
sudo journalctl -u posture-backup.service --since today --no-pager
sudo ls -l /var/backups/posture-training
```

归档包含 `app.sqlite`、`uploads.tar.gz` 和 `manifest.txt`，并配套 SHA-256 文件。恢复前必须先停应用、备份当前数据，再在临时目录中完成以下只读验证：

```bash
sha256sum -c posture-YYYYMMDDTHHMMSSZ.tar.gz.sha256
tar -tzf posture-YYYYMMDDTHHMMSSZ.tar.gz
sqlite3 restored/app.sqlite 'PRAGMA integrity_check;'
tar -tzf restored/uploads.tar.gz
```

不能只看到备份文件就判定可恢复；至少要同时通过校验和、SQLite 完整性和上传归档读取测试。异地副本应加密保存，解密密钥不得进入代码仓库、日志或备份归档本身。

## 定期复核

```bash
sudo ufw status verbose
sudo fail2ban-client status sshd
sudo ss -lntp
sudo systemd-analyze security posture-training.service --no-pager
sudo certbot renew --dry-run
curl -I https://liang111.top
curl -fsS https://liang111.top/api/health
```

预期只有 22、80、443 监听公网地址，8787 只监听 `127.0.0.1`。证书续期模拟、健康检查、首次设置锁定、未登录 401 和备份恢复测试均应定期复验。
