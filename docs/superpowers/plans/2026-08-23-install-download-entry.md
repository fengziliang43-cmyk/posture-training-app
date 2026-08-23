# 姿序移动端下载入口实施计划

1. 将共享版本提升为 1.0.5：Android `versionCode` 递增到 6，iOS 工程元数据同步到 build 5；公开 iOS manifest 继续保持无安装链接。
2. 新增登录页移动端获取区：Android APK 与校验文件直链，iPhone Safari 添加到主屏幕说明。
3. 增加组件与版本一致性测试，运行全量测试、lint、Web 构建和移动端浏览器验收。
4. 使用现有 Android SDK、JDK 21 和仓库外长期证书构建 release APK；验证包名、版本、签名、证书连续性、文件大小和 SHA-256，并停止 Gradle。
5. 在获得精确发布授权后推送提交、上传 APK/校验文件，再从同一提交创建不可变 Web release，最后验证公网下载和页面入口。
