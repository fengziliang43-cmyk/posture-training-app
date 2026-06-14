import type { DailyStatus, GeneratedPlan } from "./types";

export interface PlanExplanation {
  title: string;
  bullets: string[];
  safetyNote: string;
  summary: string;
}

export function explainPlan(plan: GeneratedPlan, status?: DailyStatus): PlanExplanation {
  const title = describePlanType(plan.type);
  const bullets = [
    plan.reason,
    describeTimeVersion(plan.timeVersion),
    describeStatusTrigger(plan, status)
  ].filter((item) => item.length > 0);
  const safetyNote = plan.safetyMessage ?? "训练中腰酸升高、动作变形或出现明显不适时停止。";

  return {
    title,
    bullets,
    safetyNote,
    summary: `${title}：${bullets.join(" ")} ${safetyNote}`.trim()
  };
}

export function localExplanationText(explanation: PlanExplanation): string {
  return `${explanation.bullets.join(" ")} ${explanation.safetyNote}`.trim();
}

function describePlanType(type: GeneratedPlan["type"]): string {
  if (type === "full") return "完整训练";
  if (type === "reduced") return "降级训练";
  return "恢复日";
}

function describeTimeVersion(timeVersion: GeneratedPlan["timeVersion"]): string {
  if (timeVersion === "full") return "今天时间够，使用完整版。";
  if (timeVersion === "short") return "今天使用短版，保留主线但减少总量。";
  return "今天时间较少，使用压缩版，只保留最关键动作。";
}

function describeStatusTrigger(plan: GeneratedPlan, status?: DailyStatus): string {
  if (!status) {
    return "";
  }

  if (hasRedFlag(status)) {
    return "你勾选了红旗症状，今天不应硬练。";
  }

  if (status.lowBackPain >= 6) {
    return `腰酸 ${status.lowBackPain}/10，优先恢复和低强度活动。`;
  }

  if (plan.type === "reduced") {
    return `腰酸 ${status.lowBackPain}/10、精神 ${status.energy}/5，今天先降低腰部压力。`;
  }

  if (plan.type === "recovery") {
    return "今天以恢复、呼吸和低强度活动为主。";
  }

  return `腰酸 ${status.lowBackPain}/10、精神 ${status.energy}/5，状态允许完成主训练。`;
}

function hasRedFlag(status: DailyStatus): boolean {
  return Boolean(
    status.redFlags?.legNumbness ||
      status.redFlags?.radiatingPain ||
      status.redFlags?.weakness ||
      status.redFlags?.bowelBladderChange ||
      status.redFlags?.sharpSuddenPain
  );
}
