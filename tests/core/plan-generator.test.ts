import { describe, expect, it } from "vitest";
import { exerciseLibrary } from "../../src/core/exercise-library";
import { generateDailyPlan } from "../../src/core/plan-generator";
import { trainingTemplates } from "../../src/core/training-templates";

describe("training templates", () => {
  it("uses only exercises present in the library", () => {
    const libraryIds = new Set(exerciseLibrary.map((exercise) => exercise.id));
    const missing = trainingTemplates.flatMap((template) =>
      template.blocks
        .flatMap((block) => block.exerciseIds)
        .filter((id) => !libraryIds.has(id))
    );

    expect(missing).toEqual([]);
  });

  it("includes the four v1 templates from the spec", () => {
    expect(trainingTemplates.map((template) => template.id)).toEqual([
      "upper-back-core",
      "glute-pelvis",
      "full-body-light",
      "recovery"
    ]);
  });
});

describe("generateDailyPlan", () => {
  it("returns recovery template for high low back pain", () => {
    const plan = generateDailyPlan({
      status: {
        date: "2026-06-11",
        lowBackPain: 7,
        energy: 3,
        availableMinutes: 45
      },
      completedMainSessionsThisWeek: 0,
      lastTemplateId: undefined
    });

    expect(plan.type).toBe("recovery");
    expect(plan.templateId).toBe("recovery");
  });

  it("returns compressed full plan when time is short but readiness is good", () => {
    const plan = generateDailyPlan({
      status: {
        date: "2026-06-11",
        lowBackPain: 2,
        energy: 5,
        availableMinutes: 15
      },
      completedMainSessionsThisWeek: 0,
      lastTemplateId: "glute-pelvis"
    });

    expect(plan.type).toBe("full");
    expect(plan.timeVersion).toBe("compressed");
    expect(plan.exercises.length).toBeGreaterThan(0);
  });

  it("uses recovery when three main sessions are already complete", () => {
    const plan = generateDailyPlan({
      status: {
        date: "2026-06-11",
        lowBackPain: 1,
        energy: 5,
        availableMinutes: 60
      },
      completedMainSessionsThisWeek: 3,
      lastTemplateId: "upper-back-core"
    });

    expect(plan.type).toBe("recovery");
    expect(plan.reason).toContain("本周已完成");
  });
});
