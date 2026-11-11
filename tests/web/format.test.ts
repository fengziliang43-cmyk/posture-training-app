import { describe, expect, it } from "vitest";
import { formatDayLabel, greetingForHour, shortReason } from "../../src/web/format";
import { describePainLevel } from "../../src/web/pain-feedback";
import { buildWeekSummary, weekDays } from "../../src/web/week";
import type { RecordsSummaryResponse } from "../../src/web/api";

describe("day labels", () => {
  it("writes the date with its weekday", () => {
    expect(formatDayLabel("2026-11-11")).toBe("11月11日 周三");
    expect(formatDayLabel("2026-11-09")).toBe("11月9日 周一");
    expect(formatDayLabel("2026-11-15")).toBe("11月15日 周日");
  });

  it("greets by the hour", () => {
    expect([2, 8, 12, 16, 21].map(greetingForHour)).toEqual(["夜深了", "早上好", "中午好", "下午好", "晚上好"]);
  });
});

describe("plan reason", () => {
  it("keeps only the sentence that is not already shown as the title and minutes", () => {
    expect(shortReason("今日状态稳定，今天可以完成完整训练，但不追求极限。 动态安排“上背拉力 + 核心稳定”，预计 23 分钟。")).toBe(
      "今日状态稳定，今天可以完成完整训练，但不追求极限。"
    );
  });

  it("returns the whole text when it has no second sentence", () => {
    expect(shortReason("历史计划")).toBe("历史计划");
  });
});

describe("pain words", () => {
  it("follows the usual 0-10 bands", () => {
    expect([0, 1, 3, 4, 6, 7, 10].map(describePainLevel)).toEqual(["没有", "轻微", "轻微", "中度", "中度", "严重", "严重"]);
  });
});

describe("the week strip", () => {
  it("runs Monday to Sunday from the week start", () => {
    const days = weekDays("2026-11-09");
    expect(days.map((day) => day.label).join("")).toBe("一二三四五六日");
    expect(days[0].date).toBe("2026-11-09");
    expect(days[6].date).toBe("2026-11-15");
  });

  it("crosses a month end without skipping a day", () => {
    expect(weekDays("2026-10-26").map((day) => day.date)).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01"
    ]);
  });

  it("is built from the records summary", () => {
    const summary = {
      weeklyReview: { weekStart: "2026-11-09" },
      trainedDates: ["2026-11-09"],
      weeklyTrainingCount: 1
    } as unknown as RecordsSummaryResponse["summary"];
    expect(buildWeekSummary(summary)).toEqual({
      weekStart: "2026-11-09",
      trainedDates: ["2026-11-09"],
      mainCount: 1,
      limit: 3
    });
  });
});
