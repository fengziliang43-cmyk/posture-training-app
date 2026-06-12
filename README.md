# 锻体修容

个人自用的体态与训练计划 App。第一版目标是让 Mac 做本地服务器，OPPO 手机通过 Tailscale 访问，按每日状态生成训练任务，并记录体态照片、训练完成情况和趋势。

## 当前能力

- 本地账号登录，密码使用 bcrypt 哈希保存。
- 每日状态输入：腰酸、精神、可训练时间，以及可选睡眠、步数、饮食、体重和红旗症状。
- 根据状态生成今日训练：完整训练、降级训练或恢复日。
- 第一版动作库、4 个训练模板、readiness 决策树、渐进规则和减载规则。
- 记录页：腰酸、睡眠、精神、体重、训练次数和进阶记录。
- 体态页：上传正面、侧面、背面照片，并支持同角度对比。
- 设置页：本地服务器、Tailscale、通知和 DeepSeek 关闭状态。
- PWA 离线缓存：缓存应用外壳和最近一次今日计划，离线完成训练后联网同步。
- Android debug APK：通过 Capacitor 封装，供 OPPO 手机本地测试安装。

## 本地运行

```bash
npm install
npm test
npm run build
npm run dev:server
npm run dev:web
```

默认地址：

```text
API server: http://localhost:8787
Web app:    http://localhost:5173
```

如果当前 shell 找不到 `npm`，本机 OpenClaw Node 工具链路径是：

```bash
PATH="/Users/liang/.openclaw/tools/node-v22.22.0/bin:$PATH" npm install
PATH="/Users/liang/.openclaw/tools/node-v22.22.0/bin:$PATH" npm test
PATH="/Users/liang/.openclaw/tools/node-v22.22.0/bin:$PATH" npm run build
```

## 数据位置

- SQLite 数据库：`data/app.sqlite`
- 体态照片：`uploads/`
- 构建产物：`dist/web/`

隐私规则：

- 不要把体态照片提交进 git。
- 不要把 `data/*.sqlite` 提交进 git。
- 不要把 `.env`、密码、token、API key 写入仓库。
- 第一版不把照片发给第三方 AI。

## 手机访问

手机访问方式见 [Tailscale Setup](docs/setup/tailscale.md)。

## Android APK

APK 打包和安装说明见 [Android APK Setup](docs/setup/android-apk.md)。

当前 debug APK 输出路径：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

这是本地测试用 debug 包，不是应用商店发布包。手机端同步、登录、照片上传和记录页仍需要 Mac server 可通过 Tailscale 访问。

## 设计与计划

- 设计规格：`docs/superpowers/specs/2026-06-11-posture-training-app-design.md`
- 实现计划：`docs/superpowers/plans/2026-06-11-posture-training-app-implementation.md`

## 后续

- 真机安装测试 APK。
- 按手机端反馈修 UI 和交互细节。
- 更完整的照片对比交互和离线同步提示。
