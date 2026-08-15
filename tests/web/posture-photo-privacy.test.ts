import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("posture photo privacy copy", () => {
  it("describes server storage without claiming Mac-only storage", () => {
    const source = readFileSync(
      new URL("../../src/web/components/PostureView.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("照片只保存在服务器，不发送给 DeepSeek");
    expect(source).not.toContain("照片只保存在 Mac");
  });
});
