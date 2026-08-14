import { describe, expect, it } from "vitest";
import { exerciseLibrary } from "../../src/core/exercise-library";
import { estimateExerciseSeconds, generateDailyPlan } from "../../src/core/plan-generator";
import type {
  EnergyScore,
  ExerciseResult,
  GeneratedExercise,
  PainScore,
  TrainingHistory
} from "../../src/core/types";

const stableStatus = {
  date: "2026-06-16",
  lowBackPain: 2 as const,
  neckShoulderPain: 2 as const,
  energy: 5 as const,
  availableMinutes: 45,
  sleepHours: 7,
  sleepQuality: 4 as const
};

describe("adaptive plan generator", () => {
  it("requires complete safety metadata for every exercise", () => {
    for (const exercise of exerciseLibrary) {
      expect(exercise.roles.length).toBeGreaterThan(0);
      expect(exercise.equipment.length).toBeGreaterThan(0);
      expect(exercise.allowedPlanTypes.length).toBeGreaterThan(0);
      expect(exercise.progression.maxSets).toBeGreaterThanOrEqual(exercise.progression.minSets);
    }
  });

  it("returns an empty executable plan when a red flag is present", () => {
    const plan = generateDailyPlan({
      status: { ...stableStatus, redFlags: { radiatingPain: true } },
      completedMainSessionsThisWeek: 0
    });

    expect(plan.templateId).toBe("adaptive-recovery");
    expect(plan.exercises).toEqual([]);
    expect(plan.decision.readinessScore).toBe(0);
  });

  it("filters high-load exercises, avoids duplicates, and respects a short time budget", () => {
    const plan = generateDailyPlan({
      status: { ...stableStatus, lowBackPain: 4, neckShoulderPain: 4, availableMinutes: 25 },
      completedMainSessionsThisWeek: 0
    });

    const ids = plan.exercises.map((exercise) => exercise.exerciseId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(plan.estimatedMinutes).toBeLessThanOrEqual(25);
    expect(plan.exercises.every((exercise) => {
      const source = exerciseLibrary.find((item) => item.id === exercise.exerciseId);
      return source !== undefined && source.load.lowBack <= 1 && source.load.shoulder <= 2;
    })).toBe(true);
    expect(plan.exercises.some((exercise) => exercise.slot === "core-anti-extension")).toBe(true);
  });

  it("is deterministic for the same status and history", () => {
    const input = {
      status: stableStatus,
      completedMainSessionsThisWeek: 1,
      history: { sessions: [] } satisfies TrainingHistory
    };

    expect(generateDailyPlan(input)).toEqual(generateDailyPlan(input));
  });

  it("keeps all compressed key slots and tries a shorter safe candidate when needed", () => {
    const plan = generateDailyPlan({
      status: { ...stableStatus, availableMinutes: 10 },
      completedMainSessionsThisWeek: 0
    });

    expect(plan.exercises.map((exercise) => exercise.slot)).toEqual(
      expect.arrayContaining(["reset", "upper-pull", "core-anti-extension"])
    );
    expect(
      plan.exercises.reduce((sum, exercise) => sum + estimateExerciseSeconds(exercise), 0)
    ).toBeLessThanOrEqual(10 * 60);
  });

  it("places an exercise with recent pain feedback into a conservative cooldown", () => {
    const painfulPullUp: GeneratedExercise = {
      exerciseId: "pull-up",
      name: "引体向上",
      sets: 3,
      reps: 5,
      restSeconds: 120,
      notes: [],
      stopCondition: "停止",
      slot: "upper-pull"
    };
    const history: TrainingHistory = {
      sessions: [{
        date: "2026-06-15",
        planType: "full",
        templateId: "adaptive-balanced",
        exercises: [painfulPullUp],
        completionStatus: "partial",
        lowBackPainBefore: 2,
        lowBackPainAfter: 3,
        exerciseResults: [{
          exerciseId: "pull-up",
          exerciseIndex: 0,
          completionStatus: "partial",
          feedback: "pain"
        }]
      }]
    };
    const plan = generateDailyPlan({
      status: stableStatus,
      completedMainSessionsThisWeek: 0,
      history
    });

    expect(plan.exercises.some((exercise) => exercise.exerciseId === "pull-up")).toBe(false);
    expect(plan.decision.avoidedReasons.join("；")).toContain("保守冷却");
  });

  it("progresses one variable after two stable weeks", () => {
    const history = buildStableBandRowHistory();
    const plan = generateDailyPlan({
      status: stableStatus,
      completedMainSessionsThisWeek: 0,
      history,
      availableEquipment: ["bodyweight", "floor", "resistance-band", "wall", "step", "walking-space"]
    });
    const bandRow = plan.exercises.find((exercise) => exercise.exerciseId === "band-row");

    expect(bandRow).toBeDefined();
    expect(bandRow?.reps).toBe(14);
    expect(bandRow?.progressionState).toBe("progressed");
  });

  it("deloads the fifth week even when readiness is good", () => {
    const plan = generateDailyPlan({
      status: stableStatus,
      completedMainSessionsThisWeek: 0,
      history: { ...buildStableBandRowHistory(), trainingStartDate: "2026-05-19" },
      availableEquipment: ["bodyweight", "floor", "resistance-band", "wall", "step", "walking-space"]
    });
    const bandRow = plan.exercises.find((exercise) => exercise.exerciseId === "band-row");

    expect(plan.decision.cycleWeek).toBe(5);
    expect(bandRow?.progressionState).toBe("deloaded");
    expect(bandRow?.sets).toBeLessThan(4);
  });

  it("never exceeds the exact time budget after exercise compression", () => {
    const plan = generateDailyPlan({
      status: { ...stableStatus, availableMinutes: 15 },
      completedMainSessionsThisWeek: 0
    });
    const totalSeconds = plan.exercises.reduce(
      (sum, exercise) => sum + estimateExerciseSeconds(exercise),
      0
    );

    expect(totalSeconds).toBeLessThanOrEqual(15 * 60);
    expect(plan.exercises.length).toBeGreaterThan(0);
  });

  it("holds safety and time invariants across the daily-status matrix", () => {
    for (let lowBackPain = 0; lowBackPain <= 10; lowBackPain += 1) {
      for (let energy = 1; energy <= 5; energy += 1) {
        for (const availableMinutes of [10, 15, 20, 30, 45, 60]) {
          for (const neckShoulderPain of [0, 4, 7]) {
            const plan = generateDailyPlan({
              status: {
                date: "2026-06-16",
                lowBackPain: lowBackPain as PainScore,
                neckShoulderPain: neckShoulderPain as PainScore,
                energy: energy as EnergyScore,
                availableMinutes
              },
              completedMainSessionsThisWeek: 0
            });
            const totalSeconds = plan.exercises.reduce(
              (sum, exercise) => sum + estimateExerciseSeconds(exercise),
              0
            );
            const ids = plan.exercises.map((exercise) => exercise.exerciseId);

            expect(totalSeconds).toBeLessThanOrEqual(availableMinutes * 60);
            expect(new Set(ids).size).toBe(ids.length);
            for (const generated of plan.exercises) {
              const source = exerciseLibrary.find((exercise) => exercise.id === generated.exerciseId);
              expect(source).toBeDefined();
              if (lowBackPain >= 4) expect(source?.load.lowBack).toBeLessThanOrEqual(1);
              if (neckShoulderPain >= 6) expect(source?.load.shoulder).toBeLessThanOrEqual(1);
            }
          }
        }
      }
    }
  });
});

function buildStableBandRowHistory(): TrainingHistory {
  return {
    trainingStartDate: "2026-06-01",
    sessions: [
      makeSession("2026-06-09"),
      makeSession("2026-06-02")
    ]
  };
}

function makeSession(date: string) {
  const bandRow: GeneratedExercise = {
    exerciseId: "band-row",
    name: "弹力带划船",
    sets: 3,
    reps: 12,
    restSeconds: 75,
    notes: [],
    stopCondition: "停止",
    slot: "upper-pull"
  };
  const bandLat: GeneratedExercise = {
    exerciseId: "band-lat-pulldown",
    name: "弹力带下拉",
    sets: 3,
    reps: 12,
    restSeconds: 75,
    notes: [],
    stopCondition: "停止",
    slot: "upper-pull"
  };
  const results: ExerciseResult[] = [
    { exerciseId: "band-row", exerciseIndex: 0, completionStatus: "completed", feedback: "none" },
    { exerciseId: "band-lat-pulldown", exerciseIndex: 1, completionStatus: "skipped", feedback: "pain" }
  ];
  return {
    date,
    planType: "full" as const,
    templateId: "adaptive-balanced" as const,
    exercises: [bandRow, bandLat],
    completionStatus: "completed" as const,
    lowBackPainBefore: 2,
    lowBackPainAfter: 2,
    exerciseResults: results
  };
}
