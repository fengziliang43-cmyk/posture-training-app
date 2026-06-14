import type { DailyStatus } from "./types";

export type WeeklyRecommendation = "maintain" | "reduce" | "recover" | "eligible-for-progression";

export interface WeeklyReviewInput {
  weekStart: string;
  weekEnd: string;
  checkins: DailyStatus[];
  completedWorkouts: number;
  completedMainWorkouts: number;
  painAfterValues: number[];
}

export interface WeeklyReview {
  weekStart: string;
  weekEnd: string;
  checkinDays: number;
  completedWorkouts: number;
  completedMainWorkouts: number;
  averageLowBackPain?: number;
  highestLowBackPain?: number;
  averageSleepHours?: number;
  averageEnergy?: number;
  painAfterAverage?: number;
  recommendation: WeeklyRecommendation;
  summary: string;
}

export function buildWeeklyReview(input: WeeklyReviewInput): WeeklyReview {
  const lowBackPainValues = input.checkins.map((checkin) => checkin.lowBackPain);
  const sleepValues = input.checkins
    .map((checkin) => checkin.sleepHours)
    .filter((value): value is number => typeof value === "number");
  const energyValues = input.checkins.map((checkin) => checkin.energy);
  const highestLowBackPain = max(lowBackPainValues);
  const averageLowBackPain = average(lowBackPainValues);
  const averageSleepHours = average(sleepValues);
  const averageEnergy = average(energyValues);
  const painAfterAverage = average(input.painAfterValues);
  const recommendation = recommend({
    completedMainWorkouts: input.completedMainWorkouts,
    highestLowBackPain,
    averageLowBackPain,
    averageEnergy
  });

  return {
    weekStart: input.weekStart,
    weekEnd: input.weekEnd,
    checkinDays: input.checkins.length,
    completedWorkouts: input.completedWorkouts,
    completedMainWorkouts: input.completedMainWorkouts,
    averageLowBackPain,
    highestLowBackPain,
    averageSleepHours,
    averageEnergy,
    painAfterAverage,
    recommendation,
    summary: buildSummary({
      completedMainWorkouts: input.completedMainWorkouts,
      highestLowBackPain,
      averageLowBackPain,
      averageEnergy,
      recommendation
    })
  };
}

export function recommendationLabel(recommendation: WeeklyRecommendation): string {
  if (recommendation === "eligible-for-progression") return "可小幅进阶";
  if (recommendation === "maintain") return "维持节奏";
  if (recommendation === "reduce") return "降低总量";
  return "优先恢复";
}

function recommend(input: {
  completedMainWorkouts: number;
  highestLowBackPain?: number;
  averageLowBackPain?: number;
  averageEnergy?: number;
}): WeeklyRecommendation {
  if ((input.highestLowBackPain ?? 0) >= 6) {
    return "recover";
  }

  if ((input.averageLowBackPain ?? 0) >= 4 || (input.averageEnergy ?? 5) <= 2.5) {
    return "reduce";
  }

  if (input.completedMainWorkouts >= 3 && (input.highestLowBackPain ?? 0) <= 3) {
    return "eligible-for-progression";
  }

  return "maintain";
}

function buildSummary(input: {
  completedMainWorkouts: number;
  highestLowBackPain?: number;
  averageLowBackPain?: number;
  averageEnergy?: number;
  recommendation: WeeklyRecommendation;
}): string {
  const painText =
    typeof input.averageLowBackPain === "number"
      ? `平均腰酸 ${round1(input.averageLowBackPain)}/10，最高 ${input.highestLowBackPain ?? "-"}/10。`
      : "本周腰酸记录还不够。";
  return `本周完成 ${input.completedMainWorkouts} 次主训练。${painText} 建议：${recommendationLabel(input.recommendation)}。`;
}

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function max(values: number[]): number | undefined {
  return values.length === 0 ? undefined : Math.max(...values);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
