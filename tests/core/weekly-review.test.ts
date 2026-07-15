import { describe, expect, it } from "vitest";
import { buildWeeklyReview } from "../../src/core/weekly-review";

describe("buildWeeklyReview", () => {
  it("recommends recovery for high pain", () => {
    const review = buildWeeklyReview({
      weekStart: "2026-06-08",
      weekEnd: "2026-06-14",
      completedWorkouts: 1,
      completedMainWorkouts: 1,
      painAfterValues: [],
      checkins: [{ date: "2026-06-14", lowBackPain: 7, energy: 3, availableMinutes: 45 }]
    });

    expect(review.recommendation).toBe("recover");
  });

  it("allows small progression for a stable full week", () => {
    const review = buildWeeklyReview({
      weekStart: "2026-06-08",
      weekEnd: "2026-06-14",
      completedWorkouts: 3,
      completedMainWorkouts: 3,
      painAfterValues: [1, 2, 1],
      checkins: [
        { date: "2026-06-11", lowBackPain: 1, energy: 5, availableMinutes: 60 },
        { date: "2026-06-12", lowBackPain: 2, energy: 4, availableMinutes: 60 },
        { date: "2026-06-13", lowBackPain: 1, energy: 5, availableMinutes: 60 }
      ]
    });

    expect(review.recommendation).toBe("eligible-for-progression");
  });
});
