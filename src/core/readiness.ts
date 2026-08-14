import type { DailyStatus, PlanType, TimeVersion, TrainingHistory } from "./types";

export interface ReadinessContext {
  history?: TrainingHistory;
  completedMainSessionsThisWeek?: number;
}

export interface ReadinessResult {
  planType: PlanType;
  timeVersion: TimeVersion;
  blocked: boolean;
  reason: string;
  score: number;
  volumeMultiplier: number;
  triggers: string[];
}

export function evaluateReadiness(
  status: DailyStatus,
  context: ReadinessContext = {}
): ReadinessResult {
  const history = context.history ?? { sessions: [] };
  const triggers: string[] = [];

  if (hasRedFlag(status)) {
    return {
      planType: "recovery",
      timeVersion: "short",
      blocked: true,
      reason: "出现红旗症状，今天不生成训练任务，先暂停训练并考虑就医评估。",
      score: 0,
      volumeMultiplier: 0,
      triggers: ["红旗症状"]
    };
  }

  let score = 100;
  const lastSession = history.sessions[0];
  const recentPainDeltas = history.sessions
    .slice(0, 3)
    .map((session) => getPainDelta(session))
    .filter((delta): delta is number => typeof delta === "number");
  const lastPainDelta = recentPainDeltas[0];
  const consecutiveRecoveryDays = countConsecutiveRecoveryDays(history);
  const recentCompletionRate = getRecentCompletionRate(history);
  const recentMainSessionCount = history.sessions
    .slice(0, 6)
    .filter((session) => session.planType !== "recovery").length;
  const lowAdherence =
    recentMainSessionCount >= 2 && recentCompletionRate !== undefined && recentCompletionRate < 0.5;

  score -= lowBackPainPenalty(status.lowBackPain);
  score -= Math.max(0, (status.neckShoulderPain ?? 0) - 2) * 3;
  score -= Math.max(0, 5 - status.energy) * 7;

  if (typeof status.sleepHours === "number") {
    if (status.sleepHours < 5) score -= 20;
    else if (status.sleepHours < 6) score -= 12;
    else if (status.sleepHours < 7) score -= 5;
  }

  if (status.sleepQuality === 1) score -= 18;
  else if (status.sleepQuality === 2) score -= 8;

  if (lastPainDelta !== undefined && lastPainDelta >= 2) {
    score -= lastPainDelta >= 3 ? 24 : 14;
    triggers.push(`上次训练后腰酸上升 ${lastPainDelta} 分`);
  }

  if (recentPainDeltas.filter((delta) => delta >= 2).length >= 2) {
    score -= 12;
    triggers.push("近期训练后疼痛反应重复出现");
  }

  if (lowAdherence) {
    score -= 10;
    triggers.push("近期训练完成率偏低");
  }

  const completedMainSessionsThisWeek = context.completedMainSessionsThisWeek ?? 0;
  if (completedMainSessionsThisWeek >= 3) {
    triggers.push(`本周已完成 ${completedMainSessionsThisWeek} 次主训练`);
  }

  if (consecutiveRecoveryDays >= 3) {
    triggers.push("连续恢复日达到 3 天");
  }

  score = clamp(Math.round(score), 0, 100);
  const timeVersion = getTimeVersion(status.availableMinutes);

  if (
    status.lowBackPain >= 6 ||
    (status.energy <= 1 && (status.sleepHours ?? 7) <= 5) ||
    status.sleepQuality === 1 ||
    (lastPainDelta !== undefined && lastPainDelta >= 3) ||
    recentPainDeltas.filter((delta) => delta >= 2).length >= 2 ||
    completedMainSessionsThisWeek >= 3 ||
    consecutiveRecoveryDays >= 3
  ) {
    if (status.lowBackPain >= 6) triggers.unshift(`腰酸 ${status.lowBackPain}/10`);
    if (status.energy <= 1 || status.sleepQuality === 1) triggers.unshift("睡眠或精神状态偏低");
    return {
      planType: "recovery",
      timeVersion: capRecoveryTime(timeVersion),
      blocked: false,
      reason: buildReason("recovery", triggers),
      score,
      volumeMultiplier: 0.5,
      triggers
    };
  }

  if (
    status.lowBackPain >= 4 ||
    status.energy <= 3 ||
    (status.sleepHours !== undefined && status.sleepHours < 6) ||
    (status.neckShoulderPain ?? 0) >= 6 ||
    lowAdherence ||
    score < 72
  ) {
    if (status.lowBackPain >= 4) triggers.unshift(`腰酸 ${status.lowBackPain}/10`);
    if (status.energy <= 3) triggers.push(`精神 ${status.energy}/5`);
    return {
      planType: "reduced",
      timeVersion,
      blocked: false,
      reason: buildReason("reduced", triggers),
      score,
      volumeMultiplier: 0.65,
      triggers
    };
  }

  if (triggers.length === 0) {
    triggers.push("今日状态稳定");
  }

  return {
    planType: "full",
    timeVersion,
    blocked: false,
    reason: buildReason("full", triggers),
    score,
    volumeMultiplier: score >= 90 ? 1 : 0.85,
    triggers
  };
}

function lowBackPainPenalty(value: number): number {
  if (value >= 8) return 55;
  if (value >= 6) return 45;
  if (value >= 5) return 28;
  if (value >= 4) return 16;
  return value * 2;
}

function getPainDelta(session: TrainingHistory["sessions"][number]): number | undefined {
  if (session.lowBackPainAfter === undefined || session.lowBackPainBefore === undefined) {
    return undefined;
  }
  return session.lowBackPainAfter - session.lowBackPainBefore;
}

function getRecentCompletionRate(history: TrainingHistory): number | undefined {
  const sessions = history.sessions.slice(0, 6).filter((session) => session.planType !== "recovery");
  if (sessions.length === 0) return undefined;

  const completed = sessions.filter((session) => session.completionStatus === "completed").length;
  return completed / sessions.length;
}

function countConsecutiveRecoveryDays(history: TrainingHistory): number {
  let count = 0;
  for (const session of history.sessions) {
    if (session.planType !== "recovery") break;
    count += 1;
  }
  return count;
}

function buildReason(planType: PlanType, triggers: string[]): string {
  const uniqueTriggers = [...new Set(triggers)].filter(Boolean);
  if (planType === "recovery") {
    return `${uniqueTriggers.join("；") || "今天优先恢复"}，今天优先恢复和低强度活动。`;
  }
  if (planType === "reduced") {
    return `${uniqueTriggers.join("；") || "状态一般"}，今天降低总量和腰背压力。`;
  }
  return `${uniqueTriggers.join("；") || "状态稳定"}，今天可以完成完整训练，但不追求极限。`;
}

export function hasRedFlag(status: DailyStatus): boolean {
  const flags = status.redFlags;
  return Boolean(
    flags?.legNumbness ||
      flags?.radiatingPain ||
      flags?.weakness ||
      flags?.bowelBladderChange ||
      flags?.sharpSuddenPain
  );
}

function getTimeVersion(minutes: number): TimeVersion {
  if (minutes < 20) return "compressed";
  if (minutes < 40) return "short";
  return "full";
}

function capRecoveryTime(timeVersion: TimeVersion): TimeVersion {
  return timeVersion === "compressed" ? "compressed" : "short";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
