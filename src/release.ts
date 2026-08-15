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

export const CURRENT_APP_VERSION = "1.0.3";

export const CURRENT_APP_BUILDS: Record<AppPlatform, number> = {
  android: 4,
  ios: 3,
  web: 2
};

const PREVIOUS_NATIVE_RELEASE_NOTES = [
  "重新整理“我的”与设置入口",
  "增加检查更新和友好的登录失败提示",
  "增加仅管理员可见的运营数据页",
  "接入仅管理员可访问的网站流量统计",
  "更新侧弯风险自查的站立与前屈示意图"
];

export const LATEST_RELEASE_MANIFEST: LatestReleaseManifest = {
  schemaVersion: 1,
  platforms: {
    android: {
      version: "1.0.2",
      build: 3,
      publishedAt: "2026-08-15",
      releaseNotes: PREVIOUS_NATIVE_RELEASE_NOTES,
      installUrl: "https://body.liang111.top/releases/zixu-android-1.0.2.apk"
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
      releaseNotes: [
        "运营数据迁移到独立管理员后台，普通账号不可见",
        "支持账号名或 QQ、Gmail 等标准邮箱登录",
        "账号与隐私增加修改密码，并撤销全部旧会话",
        "重复账号改为明确中文提示",
        "体态照片说明与服务器存储方式保持一致"
      ],
      installUrl: null
    }
  }
};
