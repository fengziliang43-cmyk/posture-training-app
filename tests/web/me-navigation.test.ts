import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
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
      "训练提醒",
      "检查更新",
      "账号与隐私",
      "规则与说明"
    ]);
    expect(settingsMenuEntries.map((entry) => entry.label)).not.toContain("服务器");
  });

  it("does not expose server configuration in login or registration", () => {
    const appSource = readFileSync(new URL("../../src/web/App.tsx", import.meta.url), "utf8");
    expect(appSource).not.toContain("服务器地址");
    expect(appSource).not.toContain("测试连接");
    expect(appSource).not.toContain("setApiBaseUrl");
  });
});
