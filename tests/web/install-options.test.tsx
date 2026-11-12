import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CURRENT_ANDROID_VERSION } from "../../src/release";
import { InstallOptions } from "../../src/web/components/InstallOptions";

describe("mobile install options", () => {
  it("offers the formal Android APK and truthful iPhone instructions", () => {
    const html = renderToStaticMarkup(<InstallOptions />);

    expect(html).toContain("下载 Android APK");
    expect(html).toContain(`https://body.liang111.top/releases/zixu-android-${CURRENT_ANDROID_VERSION}.apk`);
    expect(html).toContain(`姿序-${CURRENT_ANDROID_VERSION}.apk`);
    expect(html).toContain(`zixu-android-${CURRENT_ANDROID_VERSION}.apk.sha256`);
    expect(html).toContain("添加到主屏幕");
    expect(html).toContain("暂未上架 App Store 或 TestFlight");
    expect(html).not.toContain(".ipa");
  });
});
