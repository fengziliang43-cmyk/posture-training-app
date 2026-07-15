import { describe, expect, it } from "vitest";
import { formatLocalDate } from "../../src/core/date";

describe("formatLocalDate", () => {
  it("formats a local calendar date without converting through UTC", () => {
    expect(formatLocalDate(new Date(2026, 5, 13, 2, 30))).toBe("2026-06-13");
  });

  it("pads month and day", () => {
    expect(formatLocalDate(new Date(2026, 0, 5, 12, 0))).toBe("2026-01-05");
  });
});
