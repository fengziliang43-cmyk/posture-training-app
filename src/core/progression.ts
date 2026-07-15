export interface ProgressionInput {
  exerciseId: string;
  completedStableWeeks: number;
  currentWeekInCycle: number;
  lowBackPainMaxThisWeek: number;
  currentReps?: number;
  currentSeconds?: number;
  currentSets: number;
}

export interface ProgressionAdjustment {
  reps?: number;
  seconds?: number;
  sets: number;
  reason: string;
}

export function getProgressionAdjustment(input: ProgressionInput): ProgressionAdjustment {
  if (input.currentWeekInCycle === 5) {
    return {
      reps: input.currentReps,
      seconds: input.currentSeconds,
      sets: Math.max(1, Math.floor(input.currentSets * 0.7)),
      reason: "第 5 周自动减载，总量降低 20%-30%。"
    };
  }

  if (input.lowBackPainMaxThisWeek >= 5) {
    return {
      reps: input.currentReps,
      seconds: input.currentSeconds,
      sets: input.currentSets,
      reason: "本周腰酸偏高，不进阶。"
    };
  }

  if (input.completedStableWeeks < 2) {
    return {
      reps: input.currentReps,
      seconds: input.currentSeconds,
      sets: input.currentSets,
      reason: "稳定完成未满 2 周，保持当前难度。"
    };
  }

  if (input.currentSeconds !== undefined) {
    return {
      seconds: input.currentSeconds + 5,
      reps: input.currentReps,
      sets: input.currentSets,
      reason: "连续 2 周稳定完成，核心动作增加 5 秒。"
    };
  }

  if (input.currentReps !== undefined) {
    return {
      reps: input.currentReps + 2,
      seconds: input.currentSeconds,
      sets: input.currentSets,
      reason: "连续 2 周稳定完成，动作增加 2 次。"
    };
  }

  return {
    reps: input.currentReps,
    seconds: input.currentSeconds,
    sets: input.currentSets + 1,
    reason: "连续 2 周稳定完成，增加 1 组。"
  };
}
