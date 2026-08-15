import { describe, expect, it } from "vitest";
import { ACCOUNT_IDENTIFIER_INPUT_PATTERN } from "../../src/web/App";

describe("认证表单", () => {
  it("accepts usernames and standard email identifiers", () => {
    const pattern = new RegExp(`^(?:${ACCOUNT_IDENTIFIER_INPUT_PATTERN})$`, "v");

    expect(pattern.test("liang_1.test-user")).toBe(true);
    expect(pattern.test("member@qq.com")).toBe(true);
    expect(pattern.test("member@gmail.com")).toBe(true);
    expect(pattern.test("member@")).toBe(false);
    expect(pattern.test("ab")).toBe(false);
    expect(pattern.test("中文账号")).toBe(false);
    expect(pattern.test("space user")).toBe(false);
  });
});
