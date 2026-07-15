import { exerciseLibrary } from "./exercise-library";
import { evaluateReadiness } from "./readiness";
import { chooseNextMainTemplate, shouldPreferRecovery } from "./weekly-schedule";
import { trainingTemplates } from "./training-templates";
import type {
  DailyStatus,
  GeneratedExercise,
  GeneratedPlan,
  TrainingTemplate
} from "./types";

const exerciseById = new Map(exerciseLibrary.map((exercise) => [exercise.id, exercise] as const));
const templateById = new Map(trainingTemplates.map((template) => [template.id, template] as const));

export function generateDailyPlan(input: {
  status: DailyStatus;
  completedMainSessionsThisWeek: number;
  lastTemplateId?: TrainingTemplate["id"];
}): GeneratedPlan {
  const readiness = evaluateReadiness(input.status);
  const readinessRecovery = readiness.blocked || readiness.planType === "recovery";
  const forcedRecovery = readinessRecovery || shouldPreferRecovery(input.completedMainSessionsThisWeek);

  if (forcedRecovery) {
    const template = templateById.get("recovery");
    if (!template) {
      throw new Error("Recovery template missing.");
    }

    return buildPlan({
      status: input.status,
      readinessReason: readiness.reason,
      template,
      type: "recovery",
      timeVersion: readiness.timeVersion,
      reasonPrefix: readinessRecovery
        ? readiness.reason
        : `本周已完成 ${input.completedMainSessionsThisWeek} 次主训练，今天切恢复日。`
    });
  }

  if (readiness.planType === "reduced") {
    const template = templateById.get("full-body-light");
    if (!template) {
      throw new Error("Reduced template missing.");
    }

    return buildPlan({
      status: input.status,
      readinessReason: readiness.reason,
      template,
      type: "reduced",
      timeVersion: readiness.timeVersion,
      reasonPrefix: readiness.reason
    });
  }

  const templateId = chooseNextMainTemplate(input.lastTemplateId);
  const template = templateById.get(templateId);
  if (!template) {
    throw new Error(`Training template not found: ${templateId}`);
  }

  return buildPlan({
    status: input.status,
    readinessReason: readiness.reason,
    template,
    type: "full",
    timeVersion: readiness.timeVersion,
    reasonPrefix: readiness.reason
  });
}

function buildPlan(input: {
  status: DailyStatus;
  readinessReason: string;
  template: TrainingTemplate;
  type: GeneratedPlan["type"];
  timeVersion: GeneratedPlan["timeVersion"];
  reasonPrefix: string;
}): GeneratedPlan {
  const exercises = buildExercises(input.template, input.timeVersion);

  return {
    date: input.status.date,
    type: input.type,
    timeVersion: input.timeVersion,
    templateId: input.template.id,
    reason: `${input.reasonPrefix} 采用 ${input.template.name}。`,
    exercises,
    safetyMessage: input.readinessReason
  };
}

function buildExercises(template: TrainingTemplate, timeVersion: GeneratedPlan["timeVersion"]): GeneratedExercise[] {
  const ids = flattenTemplate(template);
  const selectedIds = selectExerciseIds(ids, timeVersion, template.id);

  return selectedIds.map((exerciseId) => {
    const exercise = exerciseById.get(exerciseId);
    if (!exercise) {
      throw new Error(`Exercise not found: ${exerciseId}`);
    }

    return {
      exerciseId: exercise.id,
      name: exercise.name,
      sets: exercise.defaultSets,
      reps: exercise.defaultReps,
      seconds: exercise.defaultSeconds,
      restSeconds: exercise.restSeconds,
      notes: exercise.coachingNotes,
      replacementId: exercise.replacementId,
      stopCondition: exercise.stopCondition
    };
  });
}

function flattenTemplate(template: TrainingTemplate): string[] {
  return template.blocks.flatMap((block) => block.exerciseIds);
}

function selectExerciseIds(
  exerciseIds: string[],
  timeVersion: GeneratedPlan["timeVersion"],
  templateId: TrainingTemplate["id"]
): string[] {
  if (timeVersion === "full") {
    return exerciseIds;
  }

  if (timeVersion === "short") {
    return exerciseIds.slice(0, Math.max(1, Math.ceil(exerciseIds.length * 0.75)));
  }

  if (templateId === "recovery") {
    return exerciseIds.slice(0, 2);
  }

  return exerciseIds.slice(0, Math.max(1, Math.ceil(exerciseIds.length * 0.6)));
}
