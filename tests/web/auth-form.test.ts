import { describe, expect, it } from "vitest";
import { USERNAME_INPUT_PATTERN } from "../../src/web/App";

describe("认证表单", () => {
  it("uses a valid Unicode Sets pattern for the username field", () => {
    const pattern = new RegExp(`^(?:${USERNAME_INPUT_PATTERN})$`, "v");

    expect(pattern.test("liang_1.test-user")).toBe(true);
    expect(pattern.test("中文账号")).toBe(false);
    expect(pattern.test("space user")).toBe(false);
  });
});
