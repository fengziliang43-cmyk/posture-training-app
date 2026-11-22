[中文](README.md) | [English](README_EN.md)

# 姿序

> 一款为脊柱侧弯人群开发的开源体态记录与辅助训练 App。

![Version](https://img.shields.io/badge/version-1.0.5-2f855a)
![App](https://img.shields.io/badge/app-PWA%20%2B%20Android%20%2B%20iOS-2563eb)
![Privacy](https://img.shields.io/badge/privacy-account%20isolated-7c3aed)
![Safety](https://img.shields.io/badge/training-safety%20first-d97706)
![License](https://img.shields.io/badge/license-MIT-0f766e)

[立即使用网页版](https://body.liang111.top/) · [下载 Android 1.0.6](https://body.liang111.top/releases/zixu-android-1.0.6.apk) · [参与共建](CONTRIBUTING.md) · [安全报告](SECURITY.md) · [MIT License](LICENSE)

## 项目定位

`姿序`（Zixu）是一款面向成人脊柱侧弯人群的开源体态记录与每日训练计划工具：根据每日简短状态打卡给出保守、可执行的训练或恢复任务，遇红旗症状立即提示停训并就医，不做医学诊断或治疗。

海外英文验证站（等候名单开放中，国内版保持免费）：[zixu.pages.dev](https://zixu.pages.dev/) · [英文站隐私说明](https://zixu.pages.dev/privacy)

固定优先级：

```text
安全 -> 体态 -> 减脂 -> 增肌 -> 体能
```

> [!IMPORTANT]
> 本项目只提供训练辅助，不用于医学诊断或治疗。出现红旗症状时应停止训练并及时寻求专业医疗评估。状态或疼痛变差时，训练计划应降级，而不是强行完成。

## 英文指南（海外验证期）

英文科普问答页与等候名单位于 [zixu.pages.dev](https://zixu.pages.dev/)（静态页托管于 Cloudflare Pages，不加载统计脚本，等候名单不收集健康详情）：

- [成人脊柱侧弯日常训练：在家能练什么、什么时候该停](https://zixu.pages.dev/guides/scoliosis-exercises-for-adults)
- [成人脊柱侧弯要慎做的动作与替代方案](https://zixu.pages.dev/guides/scoliosis-exercises-to-avoid)
- [有脊柱侧弯能跑步吗？怎么安全起步](https://zixu.pages.dev/guides/can-you-run-with-scoliosis)
- [有脊柱侧弯能做深蹲和硬拉吗？](https://zixu.pages.dev/guides/squat-deadlift-with-scoliosis)
- [50 岁以后带脊柱侧弯如何安全保持活动](https://zixu.pages.dev/guides/scoliosis-after-50)
- [如何在家自查脊柱侧弯，以及它查不出什么](https://zixu.pages.dev/guides/check-for-scoliosis-at-home)
- [如何拍出能跨月对比的体态照片](https://zixu.pages.dev/guides/posture-photos-you-can-compare)
- [脊柱侧弯伴随背痛：需要立刻就医的红旗症状](https://zixu.pages.dev/guides/back-pain-red-flags)

## 当前版本

网页版与 Android 1.0.6 均包含六页改版。iPhone 和 iPad 可通过 Safari 添加到主屏幕，目前没有公开的 App Store、TestFlight 或 IPA 下载。公开服务使用 HTTPS，注册、登录、训练记录和体态照片使用同一账号体系。

本版新增：

- 登录和注册的一次性四位图形验证码，并保留服务端限流。
- 开放每个账号自己的 DeepSeek API Key；服务器使用 AES-256-GCM 加密保存，接口不回显原文。
- 注册和修改密码最低 6 位，同时明确建议使用 10 位以上且不与其他网站重复的密码。
- 支持账号名或 QQ、Gmail 等标准邮箱地址登录；重复账号返回明确中文提示。
- 运营数据继续放在独立管理员后台，普通用户的“我的”和“设置”中不可见。

## 源码与本地运行

克隆仓库后运行：

```bash
git clone https://github.com/fengziliang43-cmyk/posture-training-app.git
cd posture-training-app
npm ci
npm test
npm run lint
npm run build
```

本地开发时通常分别启动：

```bash
npm run dev:server
npm run dev:web
```

默认地址：

```text
API server: http://localhost:8787
Web app:    http://localhost:5173
```

## 核心闭环

```text
今日状态 -> readiness 判断 -> 训练 / 降级 / 恢复任务 -> 打卡 -> 趋势复盘 -> 体态对比
```

当前产品包含：

- 账号与建档：公开注册、验证码防护、账号名或邮箱登录；新用户先完成成人确认、体能、目标、器械和功能基线建档。
- 每日状态：不适程度、精神、可训练时间，以及睡眠、步数、饮食、体重等选填项。
- 训练生成：长期档案、当日 readiness 与历史反馈三层匹配；红旗症状优先阻断。
- 动作库：拉力、肩胛控制、核心稳定、臀腿和恢复维护，附人工核对的教学视频直达链接。
- 记录页：趋势、月历状态、训练次数和动作进阶记录。
- 体态页：正面、侧面、背面照片保存到姿序服务器，并做同角度人工对比；不做 AI 或医疗诊断。
- “我的”与设置：修改密码、检查更新、个人数据导出、账号注销，以及个人 DeepSeek 配置入口。
- 客户端：同一套 React 业务代码支持 PWA、Android 和 iOS。

## 产品原则

- 数据最小化：运行时数据保存在姿序服务器的受控 SQLite 与文件目录，按账号隔离；体态照片不是必填项。
- 安全优先：状态不好时自动降级，不强推训练。
- 低摩擦：每日核心输入应在很短时间内完成。
- 不做诊断：只提供训练辅助，不替代医生评估或治疗。
- 可复盘：关注长期趋势，而不是一次性打卡。
- 规则决策：本地规则负责训练决策；AI 只预留解释和复盘能力，不读取体态照片。

## 技术路线

| 层级 | 选择 |
| --- | --- |
| 前端 | Vite + React + PWA |
| 后端 | Node.js + Fastify |
| 数据 | 服务器端 SQLite + 受控文件目录，按账号隔离 |
| 移动端 | Capacitor Android + iOS |
| 访问 | [body.liang111.top](https://body.liang111.top/)；HTTPS 反向代理访问 loopback API |
| AI | DeepSeek 只做解释和复盘，本地规则继续决定训练 |

## 开源共建

姿序以 [MIT License](LICENSE) 开源，并申请迁入[升级打怪开源社区](https://github.com/shengjidaguai-china)长期共建。项目负责人为 [@fengziliang43-cmyk](https://github.com/fengziliang43-cmyk)。

欢迎从这些方向参与：

- 核对动作教学链接、补充失效链接检查；
- 改善移动端、无障碍和离线体验；
- 补充 Web、Android、iOS 与账号隔离测试；
- 改进非诊断健康文案、隐私提示和新手文档；
- 修复带有 [`good first issue`](https://github.com/fengziliang43-cmyk/posture-training-app/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) 或 [`help wanted`](https://github.com/fengziliang43-cmyk/posture-training-app/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) 标签的问题。

开始前请阅读[贡献指南](CONTRIBUTING.md)、[行为准则](CODE_OF_CONDUCT.md)、[安全报告说明](SECURITY.md)和[第三方材料边界](THIRD_PARTY_NOTICES.md)。公开协作中严禁提交真实健康资料、体态照片、个人信息或凭证。

## Android 安装与更新

1. 在安卓手机打开 [官方下载地址](https://body.liang111.top/releases/zixu-android-1.0.6.apk)。
2. 下载后由 Android 系统继续安装；首次使用时可能需要为浏览器或文件管理器开启“允许安装未知应用”。
3. 安装必须由用户人工确认，姿序不会绕过系统执行静默安装。
4. 可下载同目录的 [SHA-256 校验文件](https://body.liang111.top/releases/zixu-android-1.0.6.apk.sha256)核对文件完整性。
5. App 内“我的 → 设置 → 检查更新”会读取官网版本清单；有新版时由用户选择下载并安装。

## 运营后台

运营页不属于普通用户功能。管理员先在 [姿序首页](https://body.liang111.top/)登录，再访问 [运营后台](https://body.liang111.top/admin)。后台展示账号、活跃、训练等聚合指标，并提供受保护的 GoAccess 网站访问统计入口；普通账号不会看到入口，也不能读取管理员接口。

## 文档入口

- [设计规格](docs/superpowers/specs/2026-06-11-posture-training-app-design.md)
- [实现计划](docs/superpowers/plans/2026-06-11-posture-training-app-implementation.md)
- [开放注册与首次建档规格](docs/superpowers/specs/2026-08-09-open-registration-onboarding-design.md)
- [Adaptive V3 规格](docs/superpowers/specs/2026-07-15-adaptive-training-engine-design.md)
- [阿里云部署手册](docs/setup/aliyun.md)
- [公网部署阻断项](docs/setup/public-web-deployment.md)
- [贡献指南](CONTRIBUTING.md)
- [维护者与决策边界](MAINTAINERS.md)
- [第三方材料边界](THIRD_PARTY_NOTICES.md)
- [项目规则](AGENTS.md)

以上仓库内链接均使用相对路径，不依赖某台电脑的本机目录。

## 隐私与安全边界

不要提交以下内容：

- 体态照片、训练照片或任何私人健康资料。
- `data/*.sqlite` 等运行时数据库。
- `.env`、API key、token、密码或其他凭证。
- APK、构建产物、缓存和 `node_modules/`。

体态照片只保存在姿序服务器的账号隔离目录，不发送给 DeepSeek 或其他第三方 AI。个人 DeepSeek API Key 按账号使用 AES-256-GCM 加密保存，不进入个人备份或接口回显。生产 API 只监听 loopback，通过 HTTPS 反向代理进入；账号密码使用 bcrypt 哈希，session token 只在数据库保存 SHA-256 摘要；登录和注册强制使用一次性图形验证码。注册、验证码和个人 Key 均保留生产紧急开关。

## 版本与验证

正式发布按“测试 → commit → push → 远端回读 → 精确提交构建 → 不可变生产 release → 原子切换”执行；服务器保留上一版回滚目录。源码仓库不保存 APK、数据库、上传照片、`.env`、API Key 或签名证书。
