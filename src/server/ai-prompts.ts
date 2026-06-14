import type { PlanExplanation } from "../core/plan-explanation";
import type { WeeklyReview } from "../core/weekly-review";
import type { StoredPlanRecord } from "./repositories";

export function buildDailyExplanationMessages(plan: StoredPlanRecord, explanation: PlanExplanation) {
  return [
    {
      role: "system" as const,
      content:
        "你是保守的私人训练解释助手。只解释既有计划，不新增动作，不改组数次数，不做医疗诊断。中文短句，直接。"
    },
    {
      role: "user" as const,
      content: [
        `计划类型：${explanation.title}`,
        `本地规则原因：${explanation.bullets.join("；")}`,
        `安全提示：${explanation.safetyNote}`,
        `动作：${plan.exercises.map((exercise) => exercise.name).join("、")}`,
        "请生成不超过120字的今日训练解释。必须提醒不适就停止。"
      ].join("\n")
    }
  ];
}

export function buildWeeklyReviewMessages(review: WeeklyReview) {
  return [
    {
      role: "system" as const,
      content:
        "你是保守的训练复盘助手。只能根据给定统计做总结，不新增训练处方，不建议激进进阶，不做医疗诊断。"
    },
    {
      role: "user" as const,
      content: [
        `周区间：${review.weekStart} 到 ${review.weekEnd}`,
        `记录天数：${review.checkinDays}`,
        `完成训练：${review.completedWorkouts}`,
        `完成主训练：${review.completedMainWorkouts}`,
        `平均腰酸：${review.averageLowBackPain ?? "-"}`,
        `最高腰酸：${review.highestLowBackPain ?? "-"}`,
        `平均睡眠：${review.averageSleepHours ?? "-"}`,
        `平均精神：${review.averageEnergy ?? "-"}`,
        `本地建议：${review.summary}`,
        "请用三句中文输出：本周状态、下周建议、注意风险。总字数不超过160字。"
      ].join("\n")
    }
  ];
}

