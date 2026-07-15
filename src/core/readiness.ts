import type { DailyStatus, PlanType, TimeVersion } from "./types";

export interface ReadinessResult {
  planType: PlanType;
  timeVersion: TimeVersion;
  blocked: boolean;
  reason: string;
}

export function evaluateReadiness(status: DailyStatus): ReadinessResult {
  if (hasRedFlag(status)) {
    return {
      planType: "recovery",
      timeVersion: "short",
      blocked: true,
      reason: "出现红旗症状，今天不生成训练任务，先暂停训练并考虑就医评估。"
    };
  }

  const timeVersion = getTimeVersion(status.availableMinutes);

  if (status.lowBackPain >= 6) {
    return {
      planType: "recovery",
      timeVersion: capRecoveryTime(timeVersion),
      blocked: false,
      reason: "腰酸达到 6/10 或以上，今天优先恢复和低强度活动。"
    };
  }

  if ((status.energy <= 1 && (status.sleepHours ?? 7) <= 5) || status.sleepQuality === 1) {
    return {
      planType: "recovery",
      timeVersion: capRecoveryTime(timeVersion),
      blocked: false,
      reason: "睡眠和精神状态都偏低，今天不硬扛，改恢复版。"
    };
  }

  if (
    status.lowBackPain >= 4 ||
    status.energy <= 3 ||
    (status.sleepHours !== undefined && status.sleepHours < 6)
  ) {
    return {
      planType: "reduced",
      timeVersion,
      blocked: false,
      reason: "状态一般，保留训练框架，但降低腰部压力和总量。"
    };
  }

  return {
    planType: "full",
    timeVersion,
    blocked: false,
    reason: "状态稳定，安排完整训练。"
  };
}

function hasRedFlag(status: DailyStatus): boolean {
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
