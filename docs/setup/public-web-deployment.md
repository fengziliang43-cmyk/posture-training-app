# 姿序公网部署准备清单

**当前状态：** 最新应用与服务器加固基线正在形成候选版；ICP备案已完成，公安联网备案已提交并等待审核。本文件不是上线授权，也不包含任何真实密钥。

## 1. 先分清两个目标

- **候选阶段可完成：** 本地验收、生产数据库隔离副本迁移、两个合成账号走完整注册与训练流程、备份恢复演练。
- **正式开放给陌生用户前必须完成：** 域名与合规路径、正式隐私政策/服务条款、账号找回、滥用防护、敏感数据存储与备份审计。

代码已经具备开放注册、首次建档、按账号隔离、个人导出、账号注销、HttpOnly session Cookie、生产配置 fail-closed，以及关闭公开版用户自带 DeepSeek Key 的能力。但这不等于已经满足正式运营条件。

## 2. 推荐的最小架构

```text
浏览器 ──HTTPS──> Nginx ──/api/*──> 127.0.0.1:8787 Fastify
                         └────────> dist/web 静态文件
                                      │
                         /var/lib/posture-training/app.sqlite
                         /var/lib/posture-training/uploads/
```

- 只让 Nginx 监听公网端口；API 只绑定 `127.0.0.1`。
- 当前线上实例升级时保留其生产数据库，但只在服务器侧备份和迁移；数据库、照片与副本都不能进入 git 或聊天输出。面向陌生用户的公开注册仍保持关闭。
- SQLite 适合首批小流量验证；持续并发、运营后台和多机部署出现后，再评估托管 PostgreSQL 与对象存储，不提前重写。
- Cloudflare 可继续做 DNS 托管。`body.liang111.top` 首次上线先使用 DNS-only；启用橙云代理前必须配置并验证可信真实 IP 来源，否则 Nginx 的按 IP 限流和审计日志会失真。

## 3. 上线前阻断项

| 项目 | 当前状态 | 放行条件 |
| --- | --- | --- |
| 正式隐私政策与服务条款 | 只有注册页摘要 | 明确运营者、联系方式、数据用途、保存期限、注销/投诉渠道并完成法律复核 |
| 密码找回与账号验证 | 未实现 | 至少完成邮箱验证与安全找回；否则只适合可人工支持的小范围测试 |
| 注册滥用防护 | 进程内限流 | 增加反向代理限流、验证码或同等级措施，并记录异常指标 |
| 体态照片保护 | 账号鉴权、非静态公开 | 服务器磁盘与备份加密、最小权限、恢复演练；公开测试默认提示用户不上传 |
| 第三方动作视频 | 使用直达外链 | 人工复核动作、来源、稳定性与对外链接边界，准备失效链接巡检和替代链接 |
| 备案与域名 | ICP 已完成，公安备案审核中 | 审核结束后再配置 `body.liang111.top`；根域保留入口，`quant.liang111.top` 保留给量化项目 |
| 运营与事故响应 | 未建立 | 建立健康检查、错误监控、备份告警、数据删除工单和联系人 |

若服务器面向中国大陆公众提供服务，至少要在选定服务器地区与主体后核对以下官方材料，再让专业人士结合实际业务确认：

- [《中华人民共和国个人信息保护法》](https://www.npc.gov.cn/WZWSREL25wYy9jMi9jMzA4MzQvMjAyMTA4L3QyMDIxMDgyMF8zMTMwODguaHRtbD9yZWY9aW1i)
- [《常见类型移动互联网应用程序必要个人信息范围规定》](https://www.cac.gov.cn/2021-03/22/c_1617990997054277.htm)
- [《网络数据安全管理条例》](https://www.cac.gov.cn/2024-09/30/c_1729384452307680.htm)
- [工业和信息化主管部门的互联网信息服务规则](https://cqca.miit.gov.cn/zwgk/zcwj/flfg/art/2026/art_3aa3d50dbe1648fda74aeab4f39b2db1.html)
- [公安机关互联网备案常见问题说明](https://ga.sz.gov.cn/ZT/HLWSYSQ/CJWT/content/post_11490792.html)

这份清单只用于工程准备，不构成法律意见。

## 4. 服务器目录与环境

推荐 Linux 目录：

```text
/opt/posture-training/                       # 只读应用代码与 dist/web
/var/lib/posture-training/                   # SQLite 和用户上传，只允许服务账号读写
/etc/posture-training/posture-training.env   # 真实环境变量，不进入 git
/var/backups/posture-training/               # root 专属备份
```

真实环境文件由部署者在服务器上单独创建，并设置为 `chmod 600`。至少需要：

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=8787
DATABASE_FILE=/var/lib/posture-training/app.sqlite
UPLOAD_DIR=/var/lib/posture-training/uploads
COOKIE_SECRET=<至少32字符的随机值>
CORS_ORIGINS=https://你的正式域名,http://localhost,capacitor://localhost,https://localhost
SECURE_COOKIES=true
SESSION_TTL_HOURS=720
PHOTO_MAX_BYTES=10485760
DEEPSEEK_USER_KEYS_ENABLED=false
REGISTRATION_ENABLED=false
```

可在服务器的私密终端用 `openssl rand -hex 32` 生成 Cookie secret，不要把输出粘贴进聊天、代码、日志或提交记录。

## 5. 构建与启动模板

每次候选发布先在干净目录执行：

```bash
npm ci
npm test
npm run lint
npm run build
```

当前服务端用 `tsx` 启动，因此服务器安装依赖时不能省略 devDependencies。小范围验证可沿用；正式扩大流量前，应增加独立的服务端编译产物，减少运行时工具链。

阿里云当前采用的模板文件：

- `deploy/posture-training.service`：systemd 沙箱，只允许写 `/var/lib/posture-training`。
- `deploy/nginx-liang111.conf`：实际 `server_name` 为 `body.liang111.top`，提供静态站点、API 反向代理、限流和安全响应头。
- `deploy/nginx-posture-security.conf`：全局限流 zone 与版本隐藏。

`deploy/zixu.service.example` 和 `deploy/Caddyfile.example` 仅作为可移植参考，不是当前阿里云生产路径。

部署者需要按服务器实际的 Node/npm 路径、域名和目录调整模板，再由管理员安装到 systemd/Caddy。模板本身不会改动服务器。

## 6. 备份与恢复演练

至少每日备份 SQLite 与上传目录，并让备份离开同一块磁盘。首次开放前必须实际恢复一次到隔离目录，而不是只确认“备份文件存在”。

一致性备份可在短暂停服窗口完成：

```bash
sudo systemctl stop posture-training
sudo sqlite3 /var/lib/posture-training/app.sqlite ".backup '/var/backups/posture-training/app.sqlite'"
sudo tar -C /var/lib/posture-training -czf /var/backups/posture-training/uploads.tar.gz uploads
sudo systemctl start posture-training
```

恢复属于覆盖性操作，只能在维护窗口、确认目标和额外保留当前副本后执行。恢复验收至少检查：

```sql
PRAGMA integrity_check;
PRAGMA foreign_key_check;
```

## 7. 上线前冒烟测试

1. `GET /api/health` 返回 `200`，且 API 进程没有公网监听。
2. HTTP 自动跳转 HTTPS；Cookie 包含 `Secure`、`HttpOnly`、`SameSite=Strict`，且有效期与服务端 session 一致。
3. 候选上线时 `REGISTRATION_ENABLED=false`：注册入口不可见、注册 API 返回 404，现有账号仍可登录。只在另行授权开启后，才测试无需邀请码的注册与首次建档。
4. 用两个账号在同一天打卡、生成计划，互相不能读取计划、照片、设置或导出。
5. 所有动作卡都有可点击的 HTTPS 视频链接，失效时不影响训练计划文本显示。
6. 个人导出只含当前账号；注销后旧 session 失效且账号数据消失。
7. 上传超限或非允许图片类型会拒绝；上传目录不能通过静态 URL 访问。
8. 断开 API、重启服务、恢复备份各演练一次，并记录结果。

## 8. 建议的发布顺序

1. 本机全量测试与构建。
2. 在隔离副本与本机端口完成迁移演练，不修改当前线上服务。
3. 两个虚拟账号做数据隔离与注销验收。
4. 公安备案审核、隐私条款和账号找回等阻断项完成后，再单独确认 `body.liang111.top` 与 5—20 名成年人小范围测试。
5. 收集留存、任务完成率、动作替换率和安全反馈后，再决定是否真正公开注册获客。

## 9. 与 Android / iOS 客户端的关系

- 网站、Android 和 iOS 共用同一个 HTTPS API、账号系统、训练引擎与数据边界。
- App 正式发行前应固定生产 API 域名，隐藏面向开发者的“服务器地址”入口；不要依赖临时 Tunnel 作为生产服务。
- 网站上线不等于 App Store 已可提交。iOS 还需单独完成正式 Bundle ID、签名、隐私问卷、截图、TestFlight 与审核，详见 [iOS App Setup](ios-app.md)。
- 首批公开验证建议先用网站降低发布成本；原生客户端并行做小范围测试，待安全与留存数据成立后再提交商店。

### 客户端更新入口

- Android 官网提供最新正式签名 APK、版本号、更新日志、文件大小和 SHA-256；App 读取同域 HTTPS 版本清单后提示更新，用户点击后跳转官网下载。
- 官网直接分发 Android APK 时，用户需为浏览器或文件管理器开启「允许安装未知应用」并人工确认安装；不做静默安装。
- iOS 官网只提供 TestFlight 公开邀请链接或 App Store 链接。新 beta 由 App Store Connect/TestFlight 通知测试用户，不在官网分发可直接安装的 IPA。
- 更新检查默认为可跳过提示；只有确认的安全问题或 API 已不兼容时才可使用强制更新，并必须保留明确原因和服务端回退方案。

任何真实部署、DNS 修改、密钥写入、服务器开通或公开发布，都需要项目所有者当次明确授权后再执行。
