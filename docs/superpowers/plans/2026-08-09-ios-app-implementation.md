# 姿序 iOS App 实施计划

**依据：** `docs/superpowers/specs/2026-08-09-ios-app-design.md`

## Task 1：工程规则与依赖

- 约定 `ios/` 目录、签名文件和构建产物的 git 边界。
- 安装与现有 Capacitor 版本一致的 `@capacitor/ios`。

## Task 2：生成原生工程

- 先构建 Web，再以 Swift Package Manager 生成 iOS 平台。
- 增加同步和打开工程的 npm scripts。

## Task 3：品牌与隐私

- 替换默认 Capacitor 图标和启动图。
- 增加相机/照片选择用途说明。
- 增加并挂载与当前数据实践一致的 `PrivacyInfo.xcprivacy`。

## Task 4：文档与发布边界

- 编写本地编译、模拟器、真机、TestFlight/App Store 前置清单。
- 明确开发 Bundle ID 与正式 Bundle ID、签名和公开发布分离。

## Task 5：验证

- 运行 `cap sync ios`、plist 校验、依赖版本检查、全量测试、lint、build 和 diff 检查。
- 当前 Mac 无完整 Xcode 时明确记录阻断，不伪造原生编译成功。
