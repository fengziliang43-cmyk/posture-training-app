import { LATEST_RELEASE_MANIFEST } from "../../release";
import { Icon } from "./ui";

/** One closed row; opens to the Android download and the iPhone home-screen steps. */
export function InstallOptions() {
  const androidRelease = LATEST_RELEASE_MANIFEST.platforms.android;
  const apkUrl = androidRelease.installUrl;
  const apkFilename = `姿序-${androidRelease.version}.apk`;

  return (
    <details className="fold-card install-fold">
      <summary>
        <Icon name="download" />
        <span>在手机上使用</span>
        <small>下载 App 或添加到主屏幕</small>
        <Icon name="right" size={16} />
      </summary>

      <div className="install-body">
        <p className="muted small">网页版、Android 和 iPhone 使用同一账号与训练数据。</p>

        <section className="install-option" aria-labelledby="android-install-title">
          <span className="auth-install-platform">Android</span>
          <strong id="android-install-title">正式版 {androidRelease.version}</strong>
          <p className="muted small">下载 APK 后，按 Android 系统提示确认安装。</p>
          {apkUrl ? (
            <div className="auth-install-actions">
              <a className="auth-install-download" href={apkUrl} download={apkFilename}>
                下载 Android APK
              </a>
              <a className="auth-install-checksum" href={`${apkUrl}.sha256`}>
                查看 SHA-256 校验
              </a>
            </div>
          ) : (
            <span className="muted small">Android 安装包正在准备。</span>
          )}
          <p className="auth-install-note">首次安装可能需要允许当前浏览器“安装未知应用”；姿序不会绕过系统确认。</p>
        </section>

        <section className="install-option" aria-labelledby="ios-install-title">
          <span className="auth-install-platform">iPhone / iPad</span>
          <strong id="ios-install-title">添加到主屏幕</strong>
          <ol className="auth-install-steps">
            <li>使用 Safari 打开 body.liang111.top。</li>
            <li>点击 Safari 底部的“分享”按钮。</li>
            <li>选择“添加到主屏幕”，再点击“添加”。</li>
          </ol>
          <p className="auth-install-note">目前暂未上架 App Store 或 TestFlight，没有可直接下载的 iOS 安装包。</p>
        </section>
      </div>
    </details>
  );
}
