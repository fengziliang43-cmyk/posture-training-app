# 姿序移动端下载入口规格

## 目标

让未登录用户在姿序登录页直接知道 Android 和 iPhone 的可用安装方式，不再依赖 GitHub README 或口头说明。

## 用户路径

- Android：登录页显示当前正式版本、APK 直链、安装提示和 SHA-256 校验入口。用户下载后仍由 Android 系统确认安装；姿序不绕过系统安全提示。
- iPhone / iPad：明确当前没有 App Store、TestFlight 或公开 IPA；提供 Safari「分享 → 添加到主屏幕」三步说明，继续使用同一 HTTPS 网站和账号。

## 发布边界

- Android 新包使用 `local.posture.training`、递增的 `versionCode` 和既有长期签名证书，确保可覆盖安装旧正式版。
- 官网只指向已完成元数据、签名、校验和与下载验证的 APK。
- iOS 不显示不可用的下载按钮，不伪造 IPA，不登录 Apple 账号或上传 TestFlight。
- APK、签名证书、密码和校验过程中的私密材料不进入 Git。

## 验收

- 390×844 登录页无需登录即可看到 Android 下载与 iPhone 使用方法。
- Android 链接指向本站 HTTPS APK，校验链接指向同名 `.sha256`。
- 页面明确提示 Android 系统安装确认和 iOS 暂未上架。
- 新 APK 的包名、版本号、版本码、v2 签名、证书连续性和 SHA-256 全部通过。
