# 姿序 iOS App 设计规格

**状态：** 2026-08-09 已批准在 Android 之外同步提供 iOS 版本。

## 1. 目标

在不重写现有 React PWA + Capacitor 架构的前提下，增加与 Android 共用前端、API 和训练规则的原生 iOS 容器，先达到本机模拟器/真机调试准备状态，后续再进入 TestFlight 和 App Store。

## 2. 技术与产品边界

- 使用与现有依赖一致的 Capacitor 8.4.0 和 Swift Package Manager。
- 最低系统版本跟随 Capacitor 8：iOS 15。
- iOS 继续使用原生客户端 bearer session，不依赖跨站 Cookie；服务端 CORS 保留 `capacitor://localhost`。
- 生产 iOS 只连接 HTTPS API，不增加允许任意 HTTP 的 App Transport Security 例外。
- 体态照片只能由用户主动选择；声明照片库和相机用途，不后台读取照片。
- 使用现有「姿序」名称、水墨图标与品牌启动图。
- iOS privacy manifest 如实声明账号标识、健康/运动数据、用户照片和备注用于 App 功能与训练个性化，不用于跟踪。

## 3. 本次不做

- 不安装或登录 Apple Developer 账号。
- 不创建证书、Provisioning Profile、发布 Bundle ID、归档或 IPA。
- 不上传 TestFlight，不提交 App Store。
- 不接入 HealthKit、Apple 登录、推送通知或内购。
- 不修改 Android 当前可覆盖安装的包名。

## 4. 验收

- `@capacitor/ios` 与其他 Capacitor 包版本一致。
- `ios/` 原生工程可由 `npx cap sync ios` 更新，使用 iOS 15 deployment target。
- App 显示名、图标和启动图为「姿序」。
- privacy manifest 与权限说明存在且 plist 格式有效。
- Web 测试、类型检查和生产构建不因 iOS 工程回归。
- 安装完整 Xcode 26+ 后，补做 Swift Package 解析、无签名模拟器编译和真机 UI 验收。
