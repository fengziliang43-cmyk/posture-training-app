# 姿序 iOS App 本地调试与发布准备

**当前状态：** Capacitor iOS 工程、品牌资源、权限说明和 privacy manifest 已生成。原始最新版曾完成模拟器安装和目视检查；2026-08-14 的 GitHub 脱敏候选又以 `local.posture.training` 完成 Capacitor 同步、Swift Package 解析及无签名 Debug 模拟器构建，结果为 `BUILD SUCCEEDED`。本文件不代表已登录 Apple 账号、完成真机签名、上传 TestFlight 或提交 App Store。

## 1. 当前技术边界

- iOS 与 Android 共用 React、训练引擎、API 和账号系统，不维护第二套业务代码。
- Capacitor 版本统一为 `8.4.0`，iOS 最低版本为 15。
- 当前 GitHub 候选使用脱敏开发 Bundle ID `local.posture.training`；它只用于候选工程，不等于现有测试安装包或未来正式发行 ID。公开发行前需选择并注册稳定的反向域名 Bundle ID，并单独评估能否原位更新已有测试 App。
- 原生端使用 bearer session；服务端已允许 `capacitor://localhost`。
- iOS 只连接 HTTPS API，不通过全局 App Transport Security 例外放开明文 HTTP。

## 2. 本机验收结果与复现流程

Capacitor 8 当前要求完整 Xcode 26 或更高版本；本机已安装 Xcode 26.6，并已接受许可。若以后重装 Xcode 后再次出现退出码 69，需由机器管理员打开 Xcode 阅读并接受许可，或在 Terminal 中执行：

```bash
sudo xcodebuild -license
```

该步骤会要求管理员密码，自动化工具不应代填或绕过。本机已下载并安装 iOS 26.5 Simulator Runtime（arm64，约 8.52 GB）；如以后重装 Xcode 或运行时缺失，可在 Xcode 的 `Settings > Components` 重新安装，也可在明确同意额外下载后使用 `xcodebuild -downloadPlatform iOS`。

若需要永久切换命令行工具，再由机器管理员执行：

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

随后在项目目录运行：

```bash
npm ci
npm run ios:sync
npm run ios:open
```

`ios:sync` 会先构建 Web，再把最新产物与 Swift Package 依赖同步进 `ios/`。`ios:open` 会打开：

```text
ios/App/App.xcodeproj
```

在 Xcode 中先选择一个 iOS 模拟器运行。连接真机时需要在 Signing & Capabilities 中选择自己的 Team；本地个人测试签名与 App Store 正式发行签名必须分开管理，证书和 Provisioning Profile 不进入仓库。

2026-08-09 实际通过的自动验收：

- `npm ci`、`npm run ios:sync`、`npm test`、`npm run lint` 和 `npm audit` 全部通过；共 16 个测试文件、67 项测试，依赖审计为 0 个已知漏洞。
- Swift Package 锁定 Capacitor `8.4.0`，`generic/platform=iOS Simulator` + `CODE_SIGNING_ALLOWED=NO` 的 Debug 构建返回 `BUILD SUCCEEDED`。
- 原始最新版快照已安装到 iPhone 17 Pro（iOS 26.5）模拟器并成功启动；GitHub 脱敏候选换用 `local.posture.training` 后，已重新完成无签名模拟器构建，尚未重新安装并目视检查。
- 本轮未登录 Apple 账号、未配置签名、未连接真机，也未上传或发布。

## 3. iOS 验收清单

1. 首次启动显示「姿序」名称、水墨图标和品牌启动图，状态栏、底部导航与安全区没有遮挡。
2. 开放注册无需邀请码；登录、退出和 session 过期行为正常。
3. 首次建档能保存年龄段、身高体重、训练基础、目标、器械、功能基线、动作限制和健康数据同意。
4. 每日状态能生成完整训练、降级训练或恢复日；红旗症状会阻断可执行动作。
5. 每个动作的“查看动作视频”能交给系统浏览器打开，返回 App 后状态不丢失。
6. 照片选择器只在用户主动点击时出现；拒绝相机或照片权限后 App 不崩溃，非图片和超限文件被拒绝。
7. 两个测试账号之间的计划、记录、照片、设置、导出和注销互相隔离。
8. 断网时能读取缓存的应用外壳和最近计划，恢复联网后离线训练记录可同步。
9. iPhone 与 iPad、浅色/深色系统外观、横竖屏至少各走一遍关键页面。

本地 iOS 连接后端也必须使用 HTTPS。临时测试可以使用当前 Cloudflare Quick Tunnel；正式测试和发布使用固定 HTTPS 域名。不要为连接局域网 HTTP 地址添加允许任意明文请求的 ATS 配置。

## 4. TestFlight 前置条件

- 决定运营主体、正式 App 名称和不会轻易更换的 Bundle ID。
- 加入 Apple Developer Program，并由账号持有人创建 App ID、证书和发行配置。
- 固定生产 HTTPS API 地址，公开版不再让普通用户手填开发服务器地址。
- 完成正式隐私政策、服务条款、支持邮箱/网页、账号删除路径与数据保留说明。
- 对 privacy manifest 与 App Store Connect 的 App Privacy 问卷逐项复核，二者必须与真实数据实践一致。
- 完成密码找回、注册滥用防护、照片与备份保护、事故响应和第三方动作视频失效巡检。
- 准备 iPhone/iPad 截图、宣传文案、关键词、年龄分级、审核说明和测试账号。
- 在干净环境通过测试、生产构建、模拟器、至少一台真机和 TestFlight 内测。

TestFlight 版本上传到 App Store Connect，测试用户通过 TestFlight 应用接受邀请、安装和接收新构建通知。官网可以放 TestFlight 公开邀请链接，但不把 IPA 当成 Android APK 一样直接提供下载。`$HOME/Desktop/锻体修容APK` 只保留最新 Android APK，不混放 TestFlight 产物。

## 5. App Store 发布门槛

Apple 自 2026-04-28 起要求 App Store Connect 上传使用 Xcode 26 或更高版本，并基于 iOS 26 SDK 或更高版本构建。真正提交前仍要重新核对 Apple 当时的最新要求。

若面向中国大陆公开提供服务，还要根据实际服务器、主体和功能核对域名/备案、移动应用备案、个人信息保护与算法/生成式 AI 等适用要求；这里是工程准备清单，不构成法律意见。

任何 Apple 账号登录、正式 Bundle ID 注册、证书/签名配置、TestFlight 上传或 App Store 提交，都需要项目所有者当次明确授权。

## 6. 官方资料

- [Capacitor iOS 文档](https://capacitorjs.com/docs/ios)
- [Capacitor 环境要求](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Capacitor iOS Privacy Manifest](https://capacitorjs.com/docs/ios/privacy-manifest)
- [Apple App Store 提交要求](https://developer.apple.com/app-store/submitting/)
- [Apple Xcode 系统要求](https://developer.apple.com/xcode/system-requirements/)
- [Apple App Privacy 管理](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
