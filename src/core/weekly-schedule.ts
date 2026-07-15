import type { TrainingTemplate } from "./types";

const mainTemplates: TrainingTemplate["id"][] = ["upper-back-core", "glute-pelvis"];

export function chooseNextMainTemplate(lastTemplateId?: TrainingTemplate["id"]): TrainingTemplate["id"] {
  if (lastTemplateId === "upper-back-core") return "glute-pelvis";
  return "upper-back-core";
}

export function shouldPreferRecovery(completedMainSessionsThisWeek: number): boolean {
  return completedMainSessionsThisWeek >= 3;
}

export function isMainTemplate(templateId: TrainingTemplate["id"]): boolean {
  return mainTemplates.includes(templateId);
}
