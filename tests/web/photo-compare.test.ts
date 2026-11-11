import { describe, expect, it } from "vitest";
import { formatLocalClock, orderOlderFirst, parseServerTimestamp } from "../../src/web/photo-compare";

describe("server timestamps", () => {
  it("reads SQLite's zone-less timestamp as UTC, not as local time", () => {
    expect(parseServerTimestamp("2026-11-11 04:17:00")?.toISOString()).toBe("2026-11-11T04:17:00.000Z");
  });

  it("keeps an explicit zone", () => {
    expect(parseServerTimestamp("2026-11-11T04:17:00Z")?.toISOString()).toBe("2026-11-11T04:17:00.000Z");
    expect(parseServerTimestamp("2026-11-11T12:17:00+08:00")?.toISOString()).toBe("2026-11-11T04:17:00.000Z");
  });

  it("returns null for something that is not a timestamp", () => {
    expect(parseServerTimestamp("not a time")).toBeNull();
    expect(parseServerTimestamp("2026-11-11")).toBeNull();
  });

  it("shows the viewer's own wall-clock time", () => {
    const parsed = parseServerTimestamp("2026-11-11 04:17:00");
    const expected = parsed?.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    expect(formatLocalClock("2026-11-11 04:17:00")).toBe(expected);
  });

  it("falls back to the raw HH:MM when the value cannot be parsed", () => {
    expect(formatLocalClock("2026-11-11 xx:yy")).toBe("xx:yy");
  });
});

describe("older photo first", () => {
  const photo = (id: number, photoDate: string, createdAt: string) => ({ id, photoDate, createdAt });

  it("orders by photo date, whatever order the list came in", () => {
    const ordered = orderOlderFirst([
      photo(3, "2026-11-10", "2026-11-10 09:00:00"),
      photo(1, "2026-11-03", "2026-11-03 09:00:00")
    ]);
    expect(ordered.map((item) => item.id)).toEqual([1, 3]);
  });

  it("tells photos from the same day apart by upload time, then by id", () => {
    const sameDay = orderOlderFirst([
      photo(5, "2026-11-10", "2026-11-10 10:00:00"),
      photo(4, "2026-11-10", "2026-11-10 09:00:00"),
      photo(6, "2026-11-10", "2026-11-10 10:00:00")
    ]);
    expect(sameDay.map((item) => item.id)).toEqual([4, 5, 6]);
  });

  it("does not change the list it was given", () => {
    const input = [photo(2, "2026-11-10", "x"), photo(1, "2026-11-03", "x")];
    orderOlderFirst(input);
    expect(input.map((item) => item.id)).toEqual([2, 1]);
  });
});
