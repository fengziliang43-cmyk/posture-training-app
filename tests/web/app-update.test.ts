import { describe, expect, it, vi } from "vitest";
import { CURRENT_APP_VERSION, LATEST_RELEASE_MANIFEST } from "../../src/release";
import {
  checkForAppUpdate,
  compareVersions,
  isTrustedInstallUrl,
  resolveReleaseEndpoint
} from "../../src/web/app-update";

describe("应用更新", () => {
  it("compares numeric version segments", () => {
    expect(compareVersions("1.0.2", "1.0.2")).toBe(0);
    expect(compareVersions("1.0.10", "1.0.2")).toBe(1);
    expect(compareVersions("1.0", "1.0.1")).toBe(-1);
  });

  it("uses the official API endpoint for native clients", () => {
    expect(resolveReleaseEndpoint(true)).toBe(
      "https://body.liang111.top/api/releases/latest"
    );
    expect(resolveReleaseEndpoint(false)).toBe("/api/releases/latest");
  });

  it("recognizes a newer Android release and its trusted APK", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(LATEST_RELEASE_MANIFEST), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));

    const result = await checkForAppUpdate({
      platform: "android",
      currentVersion: "1.0.1",
      endpoint: "https://body.liang111.top/api/releases/latest",
      fetchImpl: fetchImpl as typeof fetch
    });

    expect(result.updateAvailable).toBe(true);
    expect(result.installAvailable).toBe(true);
    expect(result.latest.version).toBe(CURRENT_APP_VERSION);
  });

  it("only accepts official HTTPS install destinations", () => {
    expect(
      isTrustedInstallUrl("android", "https://body.liang111.top/releases/zixu-android-1.0.2.apk")
    ).toBe(true);
    expect(isTrustedInstallUrl("android", "http://body.liang111.top/app.apk")).toBe(false);
    expect(isTrustedInstallUrl("android", "https://example.test/app.apk")).toBe(false);
    expect(isTrustedInstallUrl("ios", "https://testflight.apple.com/join/example")).toBe(true);
    expect(isTrustedInstallUrl("ios", "https://body.liang111.top/app.ipa")).toBe(false);
  });
});
