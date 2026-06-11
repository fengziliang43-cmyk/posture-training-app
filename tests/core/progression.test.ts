import { describe, expect, it } from "vitest";
import { getProgressionAdjustment } from "../../src/core/progression";

describe("getProgressionAdjustment", () => {
  it("adds reps after two stable completed weeks", () => {
    const result = getProgressionAdjustment({
      exerciseId: "band-row",
      completedStableWeeks: 2,
      currentWeekInCycle: 2,
      lowBackPainMaxThisWeek: 3,
      currentReps: 12,
      currentSeconds: undefined,
      currentSets: 3
    });

    expect(result.reps).toBe(14);
    expect(result.reason).toContain("连续 2 周");
  });

  it("does not progress when low back pain is high", () => {
    const result = getProgressionAdjustment({
      exerciseId: "dead-bug",
      completedStableWeeks: 3,
      currentWeekInCycle: 3,
      lowBackPainMaxThisWeek: 5,
      currentReps: undefined,
      currentSeconds: 30,
      currentSets: 3
    });

    expect(result.seconds).toBe(30);
    expect(result.reason).toContain("不进阶");
  });

  it("deloads on week five", () => {
    const result = getProgressionAdjustment({
      exerciseId: "pull-up",
      completedStableWeeks: 4,
      currentWeekInCycle: 5,
      lowBackPainMaxThisWeek: 2,
      currentReps: 5,
      currentSeconds: undefined,
      currentSets: 3
    });

    expect(result.sets).toBe(2);
    expect(result.reason).toContain("减载");
  });
});
