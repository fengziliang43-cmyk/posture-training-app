export type AppPlatform = "android" | "ios" | "web";

export interface PlatformRelease {
  version: string;
  build: number;
  publishedAt: string;
  releaseNotes: string[];
  installUrl: string | null;
}

export interface LatestReleaseManifest {
  schemaVersion: 1;
  platforms: Record<AppPlatform, PlatformRelease>;
}

export const CURRENT_APP_VERSION = "1.0.4";

export const CURRENT_APP_BUILDS: Record<AppPlatform, number> = {
  android: 5,
  ios: 4,
  web: 3
};

const PREVIOUS_NATIVE_RELEASE_NOTES = [
  "重新整理“我的”与设置入口",
  "增加检查更新和友好的登录失败提示",
  "增加仅管理员可见的运营数据页",
  "接入仅管理员可访问的网站流量统计",
  "更新侧弯风险自查的站立与前屈示意图"
];

const CURRENT_SECURITY_RELEASE_NOTES = [
  "开放按账号隔离的个人 DeepSeek API Key，并在服务器加密保存",
  "登录与注册增加一次性四位图形验证码",
  "注册和修改密码的最低长度调整为 6 位，并继续建议使用 10 位以上独立密码",
  "保留账号或标准邮箱登录、重复账号中文提示与管理员后台隔离"
];

export const LATEST_RELEASE_MANIFEST: LatestReleaseManifest = {
  schemaVersion: 1,
  platforms: {
    android: {
      version: CURRENT_APP_VERSION,
      build: CURRENT_APP_BUILDS.android,
      publishedAt: "2026-08-15",
      releaseNotes: CURRENT_SECURITY_RELEASE_NOTES,
      installUrl: "https://body.liang111.top/releases/zixu-android-1.0.4.apk"
    },
    ios: {
      version: "1.0.2",
      build: 2,
      publishedAt: "2026-08-15",
      releaseNotes: PREVIOUS_NATIVE_RELEASE_NOTES,
      installUrl: null
    },
    web: {
      version: CURRENT_APP_VERSION,
      build: CURRENT_APP_BUILDS.web,
      publishedAt: "2026-08-15",
      releaseNotes: CURRENT_SECURITY_RELEASE_NOTES,
      installUrl: null
    }
  }
};
