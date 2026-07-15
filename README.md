[中文](README.md) | [English](README_EN.md)

# 锻体修容

> 一款本地优先的个人体态与训练计划 App，把每日状态、训练任务、体态记录和长期趋势收束为低摩擦闭环。

![Status](https://img.shields.io/badge/status-MVP%20on%20feature%2Fmvp-2f855a)
![App](https://img.shields.io/badge/app-PWA%20%2B%20Android%20APK-2563eb)
![Privacy](https://img.shields.io/badge/privacy-local%20first-7c3aed)
![Safety](https://img.shields.io/badge/training-safety%20first-d97706)

## 项目定位

`锻体修容` 是一个个人使用的状态档案型训练教练。它先判断每日状态，再给出保守、可执行、可渐进的训练或恢复任务，并长期记录训练完成情况和体态趋势。

固定优先级：

```text
安全 -> 体态 -> 减脂 -> 增肌 -> 体能
```

> [!IMPORTANT]
> 本项目只提供训练辅助，不用于医学诊断或治疗。出现红旗症状时应停止训练并及时寻求专业医疗评估。状态或疼痛变差时，训练计划应降级，而不是强行完成。

## 当前状态

| 分支 | 状态 | 说明 |
| --- | --- | --- |
| `main` | 文档主线 | 保存项目规则、设计规格和实现计划。 |
| `feature/mvp` | 可运行 MVP | 包含 PWA、Fastify server、SQLite、本地照片上传、Android debug APK 打包流程和最新 UI。 |

如需查看或运行实际 App，请切换到 `feature/mvp`：

```bash
git checkout feature/mvp
npm install
npm test
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

第一版围绕以下功能设计：

- 每日状态：不适程度、精神、可训练时间，以及睡眠、步数、饮食、体重等选填项。
- 训练生成：根据红旗症状、不适程度、精神、睡眠、时间和周训练进度选择模板。
- 动作库：拉力、肩胛控制、核心稳定、臀腿和骨盆稳定、恢复维护。
- 记录页：趋势、月历状态、训练次数和动作进阶记录。
- 体态页：正面、侧面、背面照片留档与同角度人工对比。
- 设置页：本地 server、连接状态、提醒、DeepSeek 预留配置和备份导出。

## 产品原则

- 本地优先：训练记录、照片和配置默认保存在本机。
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
| 移动端 | Android browser first，稳定后用 Capacitor 封装 APK |
| 访问 | 本地 server，通过私有网络供手机访问 |
| AI | DeepSeek 只做解释和复盘，本地规则继续决定训练 |

## 文档入口

- [设计规格](docs/superpowers/specs/2026-06-11-posture-training-app-design.md)
- [实现计划](docs/superpowers/plans/2026-06-11-posture-training-app-implementation.md)
- [项目规则](AGENTS.md)

以上仓库内链接均使用相对路径，不依赖某台电脑的本机目录。

## 隐私与安全边界

不要提交以下内容：

- 体态照片、训练照片或任何私人健康资料。
- `data/*.sqlite` 等运行时数据库。
- `.env`、API key、token、密码或其他凭证。
- APK、构建产物、缓存和 `node_modules/`。

体态照片只应保存在个人设备上，不发送给第三方 AI。服务不应直接暴露到公网；远程访问应使用可信的私有网络。账号密码必须经过安全哈希，不能明文保存。

## 下一步

- 在测试手机上继续验证新版 APK 的真实使用体验。
- 根据实际反馈微调今日页、记录页和体态对比。
- 保持训练规则保守，不为视觉或功能复杂度牺牲安全边界。
