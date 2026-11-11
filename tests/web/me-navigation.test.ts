import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isAdminConsolePath } from "../../src/web/App";
import { mainTabs } from "../../src/web/components/Layout";
import { settingsMenuEntries } from "../../src/web/components/SettingsView";

describe("我的与设置导航", () => {
  it("uses 我的 as the final main tab", () => {
    expect(mainTabs.map((tab) => tab.label)).toEqual(["今日", "记录", "体态", "我的"]);
    expect(mainTabs.map((tab) => tab.id)).toEqual(["today", "records", "posture", "me"]);
  });

  it("keeps low-frequency settings behind entry rows", () => {
    expect(settingsMenuEntries.map((entry) => entry.label)).toEqual([
      "DeepSeek AI",
      "检查更新",
      "账号与隐私",
      "规则与说明"
    ]);
    expect(settingsMenuEntries.map((entry) => entry.label)).not.toContain("训练提醒");
    expect(settingsMenuEntries.map((entry) => entry.label)).not.toContain("服务器");
  });

  it("does not expose server configuration in login or registration", () => {
    const appSource = readFileSync(new URL("../../src/web/App.tsx", import.meta.url), "utf8");
    expect(appSource).not.toContain("服务器地址");
    expect(appSource).not.toContain("测试连接");
    expect(appSource).not.toContain("setApiBaseUrl");
    expect(appSource).toContain("四位数字验证码");
    expect(appSource).toContain("至少 6 位");
    expect(appSource).toContain("password-visibility-button");
    expect(appSource).toContain('aria-label={passwordVisible ? "隐藏密码" : "显示密码"}');
    expect(appSource).toContain('type={passwordVisible ? "text" : "password"}');
  });

  it("keeps operations data out of ordinary account pages", () => {
    const meSource = readFileSync(new URL("../../src/web/components/MeView.tsx", import.meta.url), "utf8");
    const adminSource = readFileSync(new URL("../../src/web/components/AdminConsole.tsx", import.meta.url), "utf8");

    expect(meSource).not.toContain("getAdminStats");
    expect(meSource).not.toContain("运营数据");
    expect(adminSource).toContain("getAdminStats");
    expect(adminSource).toContain("姿序运营后台");
    expect(isAdminConsolePath("/admin")).toBe(true);
    expect(isAdminConsolePath("/admin/")).toBe(true);
    expect(isAdminConsolePath("/")).toBe(false);
    expect(isAdminConsolePath("/settings")).toBe(false);
  });

  it("places password changes inside account and privacy settings", () => {
    const meSource = readFileSync(new URL("../../src/web/components/MeView.tsx", import.meta.url), "utf8");
    expect(meSource).toContain("修改密码");
    expect(meSource).toContain("changePassword");
    expect(meSource).toContain("所有设备上的登录都会失效");
  });

  it("allows an existing profile to be edited and previews equipment library changes", () => {
    const meSource = readFileSync(new URL("../../src/web/components/MeView.tsx", import.meta.url), "utf8");
    const onboardingSource = readFileSync(
      new URL("../../src/web/components/OnboardingView.tsx", import.meta.url),
      "utf8"
    );

    expect(meSource).toContain("setProfileEditing(true)");
    expect(meSource).toContain("initialProfile={profile}");
    expect(meSource).toContain("setProfile(updatedProfile)");
    expect(onboardingSource).toContain("getEquipmentCompatibleExercises");
    expect(onboardingSource).toContain("器械匹配运动库");
    expect(onboardingSource).toContain("saveProfile");
  });
});
