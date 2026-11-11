import type { TrainingTemplate } from "./types";

const mainTemplates: TrainingTemplate["id"][] = ["upper-back-core", "glute-pelvis"];

/** After this many finished main workouts in a week, the rest of the week is recovery days. */
export const MAX_MAIN_SESSIONS_PER_WEEK = 3;

export function chooseNextMainTemplate(lastTemplateId?: TrainingTemplate["id"]): TrainingTemplate["id"] {
  if (lastTemplateId === "upper-back-core") return "glute-pelvis";
  return "upper-back-core";
}

export function shouldPreferRecovery(completedMainSessionsThisWeek: number): boolean {
  return completedMainSessionsThisWeek >= MAX_MAIN_SESSIONS_PER_WEEK;
}

export function isMainTemplate(templateId: TrainingTemplate["id"]): boolean {
  return mainTemplates.includes(templateId);
}
