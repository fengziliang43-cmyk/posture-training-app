import { describe, expect, it } from "vitest";
import { evaluateReadiness } from "../../src/core/readiness";
import type { DailyStatus } from "../../src/core/types";

const baseStatus: DailyStatus = {
  date: "2026-06-11",
  lowBackPain: 2,
  energy: 4,
  availableMinutes: 45,
  sleepHours: 7,
  sleepQuality: 4
};

describe("evaluateReadiness", () => {
  it("blocks training when a red flag is present", () => {
    const result = evaluateReadiness({
      ...baseStatus,
      redFlags: { radiatingPain: true }
    });

    expect(result.blocked).toBe(true);
    expect(result.planType).toBe("recovery");
    expect(result.reason).toContain("红旗");
  });

  it("uses recovery when low back pain is 6 or higher", () => {
    const result = evaluateReadiness({ ...baseStatus, lowBackPain: 6 });
    expect(result.planType).toBe("recovery");
    expect(result.timeVersion).toBe("short");
  });

  it("uses reduced training for moderate low back pain", () => {
    const result = evaluateReadiness({ ...baseStatus, lowBackPain: 4 });
    expect(result.planType).toBe("reduced");
  });

  it("uses recovery for poor sleep and low energy", () => {
    const result = evaluateReadiness({
      ...baseStatus,
      lowBackPain: 4,
      energy: 1,
      sleepHours: 5
    });
    expect(result.planType).toBe("recovery");
  });

  it("compresses time when available minutes are under 20", () => {
    const result = evaluateReadiness({
      ...baseStatus,
      availableMinutes: 15
    });
    expect(result.planType).toBe("full");
    expect(result.timeVersion).toBe("compressed");
  });

  it("reduces volume after repeated low completion", () => {
    const result = evaluateReadiness(baseStatus, {
      history: {
        sessions: [
          {
            date: "2026-06-10",
            planType: "full",
            templateId: "adaptive-balanced",
            exercises: [],
            completionStatus: "partial",
            exerciseResults: []
          },
          {
            date: "2026-06-08",
            planType: "full",
            templateId: "adaptive-balanced",
            exercises: [],
            completionStatus: "skipped",
            exerciseResults: []
          }
        ]
      }
    });

    expect(result.planType).toBe("reduced");
    expect(result.triggers).toContain("近期训练完成率偏低");
  });

  it("uses recovery after repeated post-workout pain increases", () => {
    const result = evaluateReadiness(baseStatus, {
      history: {
        sessions: [
          {
            date: "2026-06-10",
            planType: "full",
            templateId: "adaptive-balanced",
            exercises: [],
            completionStatus: "completed",
            lowBackPainBefore: 2,
            lowBackPainAfter: 4,
            exerciseResults: []
          },
          {
            date: "2026-06-08",
            planType: "full",
            templateId: "adaptive-balanced",
            exercises: [],
            completionStatus: "completed",
            lowBackPainBefore: 1,
            lowBackPainAfter: 3,
            exerciseResults: []
          }
        ]
      }
    });

    expect(result.planType).toBe("recovery");
    expect(result.triggers).toContain("近期训练后疼痛反应重复出现");
  });
});
