import { describe, expect, it } from "vitest";
import type { ExerciseCompletionStatus, ExerciseResult } from "../../src/core/types";
import { deriveCompletionStatus } from "../../src/core/workout";

function results(...statuses: ExerciseCompletionStatus[]): ExerciseResult[] {
  return statuses.map((completionStatus, exerciseIndex) => ({
    exerciseId: `exercise-${exerciseIndex}`,
    exerciseIndex,
    completionStatus,
    feedback: "none"
  }));
}

describe("how a workout went", () => {
  it("is completed only when every exercise is completed", () => {
    expect(deriveCompletionStatus(results("completed", "completed"))).toBe("completed");
  });

  it("is skipped only when every exercise was skipped", () => {
    expect(deriveCompletionStatus(results("skipped", "skipped"))).toBe("skipped");
  });

  it("is partial for anything in between", () => {
    expect(deriveCompletionStatus(results("completed", "skipped"))).toBe("partial");
    expect(deriveCompletionStatus(results("completed", "partial"))).toBe("partial");
  });

  it("is partial when there are no results at all", () => {
    expect(deriveCompletionStatus([])).toBe("partial");
  });
});
