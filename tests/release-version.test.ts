import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CURRENT_ANDROID_VERSION,
  CURRENT_APP_BUILDS,
  CURRENT_APP_VERSION,
  LATEST_RELEASE_MANIFEST
} from "../src/release";

describe("release version consistency", () => {
  it("keeps package, Android, iOS and release manifest versions aligned", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8")
    ) as { version: string };
    const androidGradle = readFileSync(
      new URL("../android/app/build.gradle", import.meta.url),
      "utf8"
    );
    const iosProject = readFileSync(
      new URL("../ios/App/App.xcodeproj/project.pbxproj", import.meta.url),
      "utf8"
    );

    expect(packageJson.version).toBe(CURRENT_APP_VERSION);
    expect(androidGradle).toContain(`versionName "${CURRENT_ANDROID_VERSION}"`);
    expect(androidGradle).toContain(`versionCode ${CURRENT_APP_BUILDS.android}`);
    expect(androidGradle).toContain("ZIXU_ANDROID_KEYSTORE_PATH");
    expect(androidGradle).not.toMatch(/storePassword\s+["'][^$]/);
    expect(iosProject.match(new RegExp(`MARKETING_VERSION = ${CURRENT_APP_VERSION.replaceAll(".", "\\.")};`, "g"))).toHaveLength(2);
    expect(iosProject.match(new RegExp(`CURRENT_PROJECT_VERSION = ${CURRENT_APP_BUILDS.ios};`, "g"))).toHaveLength(2);
    expect(LATEST_RELEASE_MANIFEST.platforms.web.version).toBe(CURRENT_APP_VERSION);
    expect(LATEST_RELEASE_MANIFEST.platforms.web.build).toBe(CURRENT_APP_BUILDS.web);
    expect(LATEST_RELEASE_MANIFEST.platforms.android).toMatchObject({
      version: CURRENT_ANDROID_VERSION,
      build: CURRENT_APP_BUILDS.android,
      installUrl: `https://body.liang111.top/releases/zixu-android-${CURRENT_ANDROID_VERSION}.apk`
    });
    expect(LATEST_RELEASE_MANIFEST.platforms.ios).toMatchObject({
      version: "1.0.2",
      build: 2,
      installUrl: null
    });
  });
});
