import { describe, expect, it } from "vitest";
import { evaluateReadiness } from "../../src/core/readiness";
import type { DailyStatus, TrainingHistory, TrainingHistorySession } from "../../src/core/types";
import { describePainChange } from "../../src/web/pain-feedback";

// The sentences shown after a workout must describe what the readiness rules really do.
const status: DailyStatus = {
  date: "2026-11-10",
  lowBackPain: 2,
  energy: 4,
  availableMinutes: 30,
  sleepHours: 7,
  sleepQuality: 4,
  redFlags: {}
};

function session(before: number, after: number): TrainingHistorySession {
  return {
    date: "2026-11-09",
    planType: "full",
    templateId: "adaptive-balanced",
    exercises: [],
    completionStatus: "completed",
    lowBackPainBefore: before,
    lowBackPainAfter: after,
    exerciseResults: []
  };
}

function after(...sessions: TrainingHistorySession[]) {
  const history: TrainingHistory = { sessions };
  return evaluateReadiness(status, { history });
}

describe("what the app says about pain after a workout", () => {
  it("says nothing alarming when pain is the same or up by one", () => {
    expect(describePainChange(2, 2)).toBe("和练前相比没有明显加重。");
    expect(describePainChange(2, 3)).toBe("和练前相比没有明显加重。");
    expect(describePainChange(4, 1)).toBe("和练前相比没有明显加重。");
  });

  it("matches the rules: up by 1 changes nothing", () => {
    expect(after(session(2, 3)).score).toBe(after().score);
  });

  it("matches the rules: up by 2 lowers the score but one such day does not make a recovery day", () => {
    expect(describePainChange(2, 4)).toContain("评分会下调");
    expect(describePainChange(2, 4)).toContain("最近几次都这样的话，会改成恢复日");
    const once = after(session(2, 4));
    expect(once.score).toBeLessThan(after().score);
    expect(once.planType).not.toBe("recovery");
  });

  it("matches the rules: up by 2 on two of the last workouts makes a recovery day", () => {
    expect(after(session(2, 4), session(2, 4)).planType).toBe("recovery");
  });

  it("matches the rules: up by 3 or more makes a recovery day", () => {
    expect(describePainChange(2, 5)).toBe("比练前高 3 分，下一次会改成恢复日。");
    expect(describePainChange(1, 6)).toBe("比练前高 5 分，下一次会改成恢复日。");
    expect(after(session(2, 5)).planType).toBe("recovery");
  });
});
