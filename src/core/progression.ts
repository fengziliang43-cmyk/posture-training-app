export interface ProgressionInput {
  exerciseId: string;
  completedStableWeeks: number;
  currentWeekInCycle: number;
  lowBackPainMaxThisWeek: number;
  currentReps?: number;
  currentSeconds?: number;
  currentSets: number;
}

export interface AdaptiveProgressionInput {
  currentReps?: number;
  currentSeconds?: number;
  currentSets: number;
  stableWeeks: number;
  currentWeekInCycle: number;
  lowBackPainMax: number;
  adverseFeedback?: boolean;
  alreadyAdjustedThisWeek?: boolean;
  repsStep?: number;
  secondsStep?: number;
  maxReps?: number;
  maxSeconds?: number;
  maxSets: number;
  minSets: number;
}

export interface ProgressionAdjustment {
  reps?: number;
  seconds?: number;
  sets: number;
  state: "maintain" | "progressed" | "regressed" | "deloaded";
  reason: string;
}

export function getAdaptiveProgressionAdjustment(
  input: AdaptiveProgressionInput
): ProgressionAdjustment {
  if (input.currentWeekInCycle === 5) {
    return {
      reps: input.currentReps,
      seconds: input.currentSeconds,
      sets: Math.max(input.minSets, Math.floor(input.currentSets * 0.7)),
      state: "deloaded",
      reason: "第 5 周自动减载，总量降低约 20%-30%。"
    };
  }

  if (input.adverseFeedback) {
    return {
      reps:
        input.currentReps === undefined ? undefined : Math.max(4, input.currentReps - 2),
      seconds:
        input.currentSeconds === undefined ? undefined : Math.max(20, input.currentSeconds - 5),
      sets: Math.max(input.minSets, input.currentSets - 1),
      state: "regressed",
      reason: "近期疼痛或动作反馈偏高，不进阶，先退回可控训练量。"
    };
  }

  if (input.lowBackPainMax >= 5) {
    return {
      reps: input.currentReps,
      seconds: input.currentSeconds,
      sets: input.currentSets,
      state: "maintain",
      reason: "本周腰酸偏高，不进阶。"
    };
  }

  if (input.stableWeeks < 2 || input.alreadyAdjustedThisWeek) {
    return {
      reps: input.currentReps,
      seconds: input.currentSeconds,
      sets: input.currentSets,
      state: "maintain",
      reason: input.alreadyAdjustedThisWeek
        ? "本周已经调整过一次，保持当前训练量。"
        : "稳定完成未满 2 周，保持当前难度。"
    };
  }

  if (input.currentReps !== undefined && input.repsStep) {
    return {
      reps: Math.min(input.maxReps ?? input.currentReps + input.repsStep, input.currentReps + input.repsStep),
      seconds: input.currentSeconds,
      sets: input.currentSets,
      state: "progressed",
      reason: `连续 2 周稳定完成，动作增加 ${input.repsStep} 次。`
    };
  }

  if (input.currentSeconds !== undefined && input.secondsStep) {
    return {
      reps: input.currentReps,
      seconds: Math.min(
        input.maxSeconds ?? input.currentSeconds + input.secondsStep,
        input.currentSeconds + input.secondsStep
      ),
      sets: input.currentSets,
      state: "progressed",
      reason: `连续 2 周稳定完成，保持时间增加 ${input.secondsStep} 秒。`
    };
  }

  return {
    reps: input.currentReps,
    seconds: input.currentSeconds,
    sets: Math.min(input.maxSets, input.currentSets + 1),
    state: "progressed",
    reason: "连续 2 周稳定完成，增加 1 组。"
  };
}

/**
 * 保留 V1/V2 调用方式，内部统一走新的动作级进阶规则。
 */
export function getProgressionAdjustment(input: ProgressionInput): ProgressionAdjustment {
  return getAdaptiveProgressionAdjustment({
    currentReps: input.currentReps,
    currentSeconds: input.currentSeconds,
    currentSets: input.currentSets,
    stableWeeks: input.completedStableWeeks,
    currentWeekInCycle: input.currentWeekInCycle,
    lowBackPainMax: input.lowBackPainMaxThisWeek,
    repsStep: input.currentReps === undefined ? undefined : 2,
    secondsStep: input.currentSeconds === undefined ? undefined : 5,
    maxReps: input.currentReps === undefined ? undefined : input.currentReps + 2,
    maxSeconds: input.currentSeconds === undefined ? undefined : input.currentSeconds + 5,
    maxSets: input.currentSets + 1,
    minSets: 1
  });
}
