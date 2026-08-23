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

export const CURRENT_APP_VERSION = "1.0.5";

export const CURRENT_APP_BUILDS: Record<AppPlatform, number> = {
  android: 6,
  ios: 5,
  web: 4
};

const PREVIOUS_NATIVE_RELEASE_NOTES = [
  "重新整理“我的”与设置入口",
  "增加检查更新和友好的登录失败提示",
  "增加仅管理员可见的运营数据页",
  "接入仅管理员可访问的网站流量统计",
  "更新侧弯风险自查的站立与前屈示意图"
];

const CURRENT_APP_RELEASE_NOTES = [
  "训练档案支持修改，并回填现有目标、体能、器械和训练条件",
  "器械变化会实时更新候选运动库，并影响后续计划与动作替换",
  "登录和注册密码框增加显示与隐藏按钮",
  "登录页增加 Android 正式包下载和 iPhone 添加到主屏幕说明"
];

export const LATEST_RELEASE_MANIFEST: LatestReleaseManifest = {
  schemaVersion: 1,
  platforms: {
    android: {
      version: CURRENT_APP_VERSION,
      build: CURRENT_APP_BUILDS.android,
      publishedAt: "2026-08-23",
      releaseNotes: CURRENT_APP_RELEASE_NOTES,
      installUrl: "https://body.liang111.top/releases/zixu-android-1.0.5.apk"
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
      publishedAt: "2026-08-23",
      releaseNotes: CURRENT_APP_RELEASE_NOTES,
      installUrl: null
    }
  }
};
