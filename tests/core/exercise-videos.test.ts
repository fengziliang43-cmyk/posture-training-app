import { describe, expect, it } from "vitest";
import {
  exerciseLibrary,
  getEquipmentCompatibleExercises
} from "../../src/core/exercise-library";
import { generateDailyPlan } from "../../src/core/plan-generator";
import type { TrainingProfile } from "../../src/core/types";

const profile: TrainingProfile = {
  ageRange: "30-44",
  fitnessLevel: "regular",
  goals: ["safe-movement", "posture"],
  equipment: [
    "bodyweight",
    "floor",
    "pull-up-bar",
    "resistance-band",
    "wall",
    "step",
    "walking-space"
  ],
  weeklyTrainingDays: 3,
  defaultSessionMinutes: 45,
  canWalk20Minutes: true,
  canChairStand: true,
  canHoldSupport20Seconds: true,
  limitations: [],
  onboardingVersion: "test-v1",
  completedAt: "2026-08-09T00:00:00.000Z"
};

describe("exercise demonstration videos", () => {
  it("gives every library action a direct HTTPS video page", () => {
    expect(exerciseLibrary).toHaveLength(22);
    expect(new Set(exerciseLibrary.map((exercise) => exercise.id)).size).toBe(exerciseLibrary.length);
    for (const exercise of exerciseLibrary) {
      expect(exercise.videoUrl).toMatch(/^https:\/\/www\.bilibili\.com\/video\//);
      expect(exercise.videoSource).toContain("第三方动作示范");
    }
  });

  it("keeps video metadata on every generated action", () => {
    const plan = generateDailyPlan({
      status: {
        date: "2026-08-09",
        lowBackPain: 1,
        neckShoulderPain: 1,
        energy: 5,
        availableMinutes: 45
      },
      completedMainSessionsThisWeek: 0,
      history: { sessions: [] },
      profile
    });

    expect(plan.exercises.length).toBeGreaterThan(0);
    for (const exercise of plan.exercises) {
      expect(exercise.videoUrl).toMatch(/^https:\/\//);
      expect(exercise.videoSource).toBeTruthy();
    }
  });

  it("uses profile equipment and limitations as hard filters", () => {
    const plan = generateDailyPlan({
      status: {
        date: "2026-08-09",
        lowBackPain: 1,
        neckShoulderPain: 1,
        energy: 5,
        availableMinutes: 45
      },
      completedMainSessionsThisWeek: 0,
      history: { sessions: [] },
      profile: {
        ...profile,
        fitnessLevel: "beginner",
        equipment: ["bodyweight", "floor", "wall", "walking-space"],
        limitations: ["shoulder"]
      }
    });

    for (const generated of plan.exercises) {
      const source = exerciseLibrary.find((exercise) => exercise.id === generated.exerciseId);
      expect(source).toBeTruthy();
      expect(source?.difficulty).toBeLessThanOrEqual(2);
      expect(source?.load.shoulder).toBeLessThanOrEqual(1);
      expect(source?.equipment.every((item) => profileEquipment.has(item))).toBe(true);
    }
  });

  it("rebuilds the equipment-compatible library when equipment changes", () => {
    const floorOnly = getEquipmentCompatibleExercises(["bodyweight", "floor", "wall", "walking-space"]);
    const withBand = getEquipmentCompatibleExercises([
      "bodyweight",
      "floor",
      "wall",
      "walking-space",
      "resistance-band"
    ]);

    expect(floorOnly.some((exercise) => exercise.id === "band-row")).toBe(false);
    expect(withBand.some((exercise) => exercise.id === "band-row")).toBe(true);
    expect(withBand.length).toBeGreaterThan(floorOnly.length);
    expect(withBand.every((exercise) =>
      exercise.equipment.every((item) => new Set([
        "bodyweight",
        "floor",
        "wall",
        "walking-space",
        "resistance-band"
      ]).has(item))
    )).toBe(true);
  });
});

const profileEquipment = new Set(["bodyweight", "floor", "wall", "walking-space"]);
