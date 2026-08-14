# 姿序 2026-08-14 候选验收记录

## 候选边界

- 基于已脱敏、可公开的 Git 历史制作，不连接旧的私密提交历史。
- 应用源码与原始最新版快照逐文件对账；差异仅限本记录列出的纠偏、安全和脱敏调整。
- 根域继续作为网站入口；姿序目标域名为 `body.liang111.top`，量化目标域名为 `quant.liang111.top`。
- 本候选未修改线上代码、数据库、DNS、Cloudflare、注册状态或公安备案页面。
- 本候选未推送 GitHub；本地 commit 也不代表合并或部署授权。

## 纠偏内容

- 保留最新版首次建档、Adaptive V3、动作视频、多人隔离、账号导出/注销、Android 与 iOS 工程。
- 生产环境注册默认关闭；前端读取 capability 后隐藏入口，后端同时对注册请求返回 404。
- 网页 session Cookie 使用 `Secure`、`HttpOnly`、`SameSite=Strict`，Cookie 有效期与服务端 session 配置一致。
- 移除对特定账号名的显示名称映射与测试中的本机用户名。
- 登录页恢复 ICP 备案号和工信部链接；公安备案号只在审核通过后再加入。
- Nginx 候选改为 `body.liang111.top`，补 HTTP 到 HTTPS 跳转、TLS 入口和登录/注册限流范围。
- Git 忽略规则覆盖 `.env.*`、私钥/签名材料、数据库、上传、APK/IPA、DerivedData、构建产物和本机元数据。

## 验证结果

| 项目 | 结果 |
| --- | --- |
| 依赖安装 | `npm ci` 通过 |
| 单元/集成测试 | 16 个测试文件、69 项测试全部通过 |
| TypeScript | `npm run lint` 通过 |
| Web 生产构建 | `npm run build` 通过 |
| 依赖审计 | `npm audit --audit-level=high`：0 个已知漏洞 |
| 登录页可视验收 | 默认只有登录；无预填账号；ICP 备案号可见；无注册空白占位 |
| Capacitor | Android、iOS 同步通过，候选 ID 一致为 `local.posture.training` |
| iOS | Xcode 无签名 Debug 模拟器构建 `BUILD SUCCEEDED` |
| Android | 工程同步通过；本机缺少 JDK 21，本轮未重新编译 APK |

## 生产备份副本迁移

迁移只在加密生产备份的临时解密副本上执行，未读取或输出用户名、密码哈希、健康资料或照片内容。临时解密副本在验收结束后清理。

| 检查 | 迁移前 | 迁移后 |
| --- | ---: | ---: |
| schema version | 0 | 2 |
| users | 1 | 1 |
| checkins | 1 | 1 |
| plans | 1 | 1 |
| `PRAGMA integrity_check` | ok | ok |
| 外键违规 | 0 | 0 |
| 无 `user_id` 的打卡/计划 | 不适用 | 0 |
| 迁移前自动备份 | 不适用 | 已生成 1 份 |

## 线上安全只读复核

- 姿序服务、Nginx、UFW、Fail2ban 与备份 timer 均为 active/valid。
- SSH 已禁止 root 登录、密码认证、X11 和 TCP 端口转发。
- 公网监听为 22/80/443；应用端口 8787 只监听 loopback。
- 备份脚本为 root 专属，已有 2 份归档，最新归档记录数据库完整性为 `ok`。

## 仍需单独授权

1. GitHub push 与候选分支/目标分支选择。
2. 公安备案审核结束后的 `body.liang111.top` DNS 与证书配置。
3. 生产部署、数据库原位迁移与回滚窗口。
4. `REGISTRATION_ENABLED=true`、小范围测试或公开注册。
5. 使用 JDK 21 重新构建、签名和验收 Android APK。
