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

export const CURRENT_APP_VERSION = "1.0.2";

export const CURRENT_APP_BUILDS: Record<AppPlatform, number> = {
  android: 3,
  ios: 2,
  web: 1
};

export const LATEST_RELEASE_MANIFEST: LatestReleaseManifest = {
  schemaVersion: 1,
  platforms: {
    android: {
      version: CURRENT_APP_VERSION,
      build: CURRENT_APP_BUILDS.android,
      publishedAt: "2026-08-15",
      releaseNotes: [
        "重新整理“我的”与设置入口",
        "增加检查更新和友好的登录失败提示",
        "增加仅管理员可见的运营数据页"
      ],
      installUrl: `https://body.liang111.top/releases/zixu-android-${CURRENT_APP_VERSION}.apk`
    },
    ios: {
      version: CURRENT_APP_VERSION,
      build: CURRENT_APP_BUILDS.ios,
      publishedAt: "2026-08-15",
      releaseNotes: [
        "重新整理“我的”与设置入口",
        "增加检查更新和友好的登录失败提示",
        "增加仅管理员可见的运营数据页"
      ],
      installUrl: null
    },
    web: {
      version: CURRENT_APP_VERSION,
      build: CURRENT_APP_BUILDS.web,
      publishedAt: "2026-08-15",
      releaseNotes: [
        "重新整理“我的”与设置入口",
        "增加检查更新和友好的登录失败提示",
        "增加仅管理员可见的运营数据页"
      ],
      installUrl: null
    }
  }
};
