import { describe, expect, it } from "vitest";
import { explainPlan } from "../../src/core/plan-explanation";
import { generateDailyPlan } from "../../src/core/plan-generator";

describe("explainPlan", () => {
  it("mentions recovery for high low back pain", () => {
    const status = { date: "2026-06-14", lowBackPain: 7, energy: 3, availableMinutes: 45 } as const;
    const plan = generateDailyPlan({ status, completedMainSessionsThisWeek: 0 });

    const explanation = explainPlan(plan, status);

    expect(explanation.title).toBe("恢复日");
    expect(explanation.summary).toContain("腰酸 7/10");
  });

  it("mentions compressed version when time is short", () => {
    const status = { date: "2026-06-14", lowBackPain: 1, energy: 5, availableMinutes: 15 } as const;
    const plan = generateDailyPlan({ status, completedMainSessionsThisWeek: 0 });

    const explanation = explainPlan(plan, status);

    expect(explanation.summary).toContain("压缩版");
  });
});
