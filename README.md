[中文](README.md) | [English](README_EN.md)

# 姿序

> 一款安全优先、可按账号隔离的体态与训练计划 App，把首次建档、每日状态、训练任务、体态记录和长期趋势收束为低摩擦闭环。

![Status](https://img.shields.io/badge/status-release%20candidate-2f855a)
![App](https://img.shields.io/badge/app-PWA%20%2B%20Android%20%2B%20iOS-2563eb)
![Privacy](https://img.shields.io/badge/privacy-account%20isolated-7c3aed)
![Safety](https://img.shields.io/badge/training-safety%20first-d97706)

## 项目定位

`姿序` 是一个状态档案型训练教练。它先用首次建档限定动作与起始难度，再判断每日状态，给出保守、可执行、可渐进的训练或恢复任务，并长期记录完成情况与体态趋势。

固定优先级：

```text
安全 -> 体态 -> 减脂 -> 增肌 -> 体能
```

> [!IMPORTANT]
> 本项目只提供训练辅助，不用于医学诊断或治疗。出现红旗症状时应停止训练并及时寻求专业医疗评估。状态或疼痛变差时，训练计划应降级，而不是强行完成。

## 当前状态

当前仓库候选包含最新版 PWA、Fastify、SQLite、Android/iOS Capacitor 工程、首次建档、多用户数据隔离、持久 session、账号导出/注销、Adaptive V3 训练引擎与动作视频。候选分支不代表已推送、合并或部署。

在候选目录运行：

```bash
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

当前候选围绕以下功能设计：

- 账号与建档：开放注册能力受生产闸门控制；新用户先完成成人确认、体能、目标、器械和功能基线建档。
- 每日状态：不适程度、精神、可训练时间，以及睡眠、步数、饮食、体重等选填项。
- 训练生成：长期档案、当日 readiness 与历史反馈三层匹配；红旗症状优先阻断。
- 动作库：拉力、肩胛控制、核心稳定、臀腿和恢复维护，附人工核对的教学视频直达链接。
- 记录页：趋势、月历状态、训练次数和动作进阶记录。
- 体态页：正面、侧面、背面照片留档与同角度人工对比。
- 设置页：连接状态、提醒、个人数据导出、账号注销与受控的 DeepSeek 解释能力。
- 客户端：同一套 React 业务代码支持 PWA、Android 和 iOS。

## 产品原则

- 数据最小化：运行时数据保存在受控 SQLite 与文件目录，按账号隔离；体态照片不是必填项。
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
| 数据 | SQLite + 本地文件系统 |
| 移动端 | Capacitor Android + iOS |
| 访问 | 本地私有网络测试；生产环境通过 HTTPS 反向代理访问 loopback API |
| AI | DeepSeek 只做解释和复盘，本地规则继续决定训练 |

## 文档入口

- [设计规格](docs/superpowers/specs/2026-06-11-posture-training-app-design.md)
- [实现计划](docs/superpowers/plans/2026-06-11-posture-training-app-implementation.md)
- [开放注册与首次建档规格](docs/superpowers/specs/2026-08-09-open-registration-onboarding-design.md)
- [Adaptive V3 规格](docs/superpowers/specs/2026-07-15-adaptive-training-engine-design.md)
- [阿里云部署手册](docs/setup/aliyun.md)
- [公网部署阻断项](docs/setup/public-web-deployment.md)
- [项目规则](AGENTS.md)

以上仓库内链接均使用相对路径，不依赖某台电脑的本机目录。

## 隐私与安全边界

不要提交以下内容：

- 体态照片、训练照片或任何私人健康资料。
- `data/*.sqlite` 等运行时数据库。
- `.env`、API key、token、密码或其他凭证。
- APK、构建产物、缓存和 `node_modules/`。

体态照片不发送给第三方 AI。生产 API 只监听 loopback，通过 HTTPS 反向代理进入；账号密码使用 bcrypt 哈希，session token 只在数据库保存 SHA-256 摘要。生产注册默认关闭，只有显式设置 `REGISTRATION_ENABLED=true` 才开放。

## 下一步

- 在隔离的生产数据库副本上验证迁移、完整性与回滚。
- 完成候选测试、构建、隐私扫描与移动端工程检查。
- 公安备案与部署条件满足后，再分别确认 GitHub 推送、`body.liang111.top` DNS 和生产发布；根域继续作为网站入口，`quant.liang111.top` 留给量化项目。
