# 阿里云轻量应用服务器部署（姿序子域）

本文档用于把姿序候选部署到 Ubuntu 24.04 轻量应用服务器。服务仅监听本机 `127.0.0.1:8787`，公网流量统一通过 Nginx 和 HTTPS 进入。域名职责固定为：`liang111.top` 是网站入口，`body.liang111.top` 是姿序，`quant.liang111.top` 是量化。公安联网备案审核期间不修改现有线上 DNS 或页面。

Cloudflare 可以继续托管域名 DNS，不需要迁移 nameserver。首次配置 `body.liang111.top` 时建议先用 **DNS only**，这样 Nginx 的 `$remote_addr`、限流和日志就是访客真实 IP；若以后开启橙云代理，必须先按 Cloudflare 当时的官方 IP 段配置可信 `real_ip`，再复核限流与日志，不能直接信任任意来源传入的 `CF-Connecting-IP`。

## 生产环境变量

在 `/etc/posture-training/posture-training.env` 中设置：

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=8787
DATABASE_FILE=/var/lib/posture-training/app.sqlite
UPLOAD_DIR=/var/lib/posture-training/uploads
COOKIE_SECRET=使用 openssl rand -hex 32 生成
CORS_ORIGINS=https://body.liang111.top,http://localhost,capacitor://localhost,https://localhost
SECURE_COOKIES=true
SESSION_TTL_HOURS=720
PHOTO_MAX_BYTES=10485760
DEEPSEEK_USER_KEYS_ENABLED=true
AUTH_CAPTCHA_ENABLED=true
REGISTRATION_ENABLED=false
```

该文件权限应为 `600`，数据目录权限应仅授予运行服务的 `admin` 用户。真实随机值只在服务器私密终端生成，不粘贴到聊天、代码、提交或日志。

## 部署结构

- 代码与前端产物：`/opt/posture-training`
- SQLite 和照片：`/var/lib/posture-training`
- 环境变量：`/etc/posture-training/posture-training.env`
- systemd：`/etc/systemd/system/posture-training.service`
- Nginx：`/etc/nginx/sites-available/body.liang111.top`
- Nginx 全局限流：`/etc/nginx/conf.d/posture-security.conf`
- 自动备份：`/usr/local/sbin/posture-backup`、`posture-backup.timer`

仓库中的 Nginx 候选按 DNS-only 直连来源设计。证书路径必须在证书实际签发后再启用；使用 Cloudflare Origin CA 时，只替换服务器上的证书路径，不把私钥复制进仓库。

生产环境关闭旧版 `/api/auth/setup`。现有数据库会通过兼容迁移保留原账号和数据；首次换版前必须先备份，并在生产数据库的隔离副本上完成迁移、登录、回滚和完整性验证。`REGISTRATION_ENABLED=false` 时现有账号可登录，但新账号注册入口和 API 都关闭。

## 上线后检查

```bash
systemctl status posture-training --no-pager
curl -fsS http://127.0.0.1:8787/api/health
nginx -t
curl -I https://body.liang111.top
```

首页底部必须保留 ICP 备案号及工信部链接。公安联网备案通过后，再加入公安备案图标、编号和官方查询链接。

## 安全基线

生产服务器执行以下基线，不把应用端口直接暴露到公网：

- UFW 默认拒绝入站，只放行 `22/tcp`、`80/tcp`、`443/tcp`；应用仅监听 `127.0.0.1:8787`。
- SSH 仅允许 `admin` 通过密钥登录；禁止 root、密码登录、X11、端口转发和隧道。
- Fail2ban 监控 `sshd`，10 分钟内失败 5 次后通过 UFW 封禁 1 小时。
- 登录、注册和旧版首次设置接口按来源 IP 限制为每分钟 5 次；其余 API 为每秒 20 次并限制并发连接。
- HTTPS 响应发送 HSTS、CSP、`nosniff`、禁止嵌入和最小权限策略；API 额外发送 `Cache-Control: no-store`。
- systemd 服务采用只读系统、独立临时目录、空 capability 集合、禁止命名空间和内核参数访问等沙箱限制。
- 数据库权限为 `600`，上传目录权限为 `700`，服务环境文件权限为 `600`。
- session 持久化到 SQLite，只保存 token 的 SHA-256 摘要；默认有效期 30 天并与 Cookie `Max-Age` 一致，服务重启后仍可验证。网页 Cookie 使用 `Secure`、`HttpOnly`、`SameSite=Strict`。
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
curl -I https://body.liang111.top
curl -fsS https://body.liang111.top/api/health
```

预期只有 22、80、443 监听公网地址，8787 只监听 `127.0.0.1`。证书续期模拟、健康检查、注册闸门关闭、旧版设置接口 404、未登录 401 和备份恢复测试均应定期复验。
