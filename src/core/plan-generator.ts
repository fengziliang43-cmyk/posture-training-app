import { exerciseLibrary } from "./exercise-library";
import { getAdaptiveProgressionAdjustment } from "./progression";
import { evaluateReadiness, type ReadinessResult } from "./readiness";
import type {
  DailyStatus,
  Exercise,
  ExerciseEquipment,
  ExerciseRole,
  GeneratedExercise,
  GeneratedPlan,
  PlanType,
  ProgressionState,
  TrainingProfile,
  TrainingHistory,
  TrainingHistorySession,
  TrainingTemplate
} from "./types";

export const ADAPTIVE_ALGORITHM_VERSION = "adaptive-v3";

const DEFAULT_EQUIPMENT: ExerciseEquipment[] = [
  "bodyweight",
  "floor",
  "pull-up-bar",
  "resistance-band",
  "wall",
  "step",
  "walking-space"
];

interface SlotRequest {
  role: ExerciseRole;
  required: boolean;
}

interface CandidateScore {
  exercise: Exercise;
  score: number;
  reason: string;
}

interface GeneratedVolume {
  sets: number;
  reps?: number;
  seconds?: number;
  progressionState: ProgressionState;
  reason: string;
}

export function generateDailyPlan(input: {
  status: DailyStatus;
  completedMainSessionsThisWeek: number;
  lastTemplateId?: TrainingTemplate["id"];
  history?: TrainingHistory;
  availableEquipment?: ExerciseEquipment[];
  profile?: TrainingProfile;
}): GeneratedPlan {
  const history = input.history ?? { sessions: [] };
  const availableEquipment = new Set(
    input.availableEquipment ?? input.profile?.equipment ?? DEFAULT_EQUIPMENT
  );
  const readiness = evaluateReadiness(input.status, {
    history,
    completedMainSessionsThisWeek: input.completedMainSessionsThisWeek
  });
  const cycleWeek = getCycleWeek(history.trainingStartDate, input.status.date);
  const avoidedReasons = buildAvoidedReasons(input.status, history, readiness);

  if (readiness.blocked) {
    return {
      date: input.status.date,
      type: "recovery",
      timeVersion: readiness.timeVersion,
      templateId: "adaptive-recovery",
      reason: readiness.reason,
      exercises: [],
      safetyMessage: readiness.reason,
      algorithmVersion: ADAPTIVE_ALGORITHM_VERSION,
      estimatedMinutes: 0,
      decision: {
        readinessScore: 0,
        volumeMultiplier: 0,
        focusLabel: "停止训练",
        reasons: readiness.triggers,
        avoidedReasons,
        cycleWeek
      }
    };
  }

  const weeklyCoverage = getRoleCoverage(history, input.status.date, 7);
  const slotRequests = buildSlotRequests(readiness.planType, readiness.timeVersion, weeklyCoverage)
    .sort((a, b) => Number(b.required) - Number(a.required));
  const selectedIds = new Set<string>();
  const exercises: GeneratedExercise[] = [];
  const budgetSeconds = input.status.availableMinutes * 60;
  let usedSeconds = 0;

  for (const slot of slotRequests) {
    const candidates = rankCandidates({
      role: slot.role,
      planType: readiness.planType,
      status: input.status,
      history,
      selectedIds,
      availableEquipment,
      weeklyCoverage,
      profile: input.profile,
      remainingSeconds: Math.max(0, budgetSeconds - usedSeconds)
    });

    if (candidates.length === 0) {
      avoidedReasons.push(`“${roleLabel(slot.role)}”没有符合今日安全条件的动作`);
      continue;
    }

    let selected: CandidateScore | undefined;
    let generated: GeneratedExercise | undefined;
    let durationSeconds = 0;
    const remainingSeconds = Math.max(0, budgetSeconds - usedSeconds);

    for (const candidate of candidates) {
      const volume = buildVolume({
        exercise: candidate.exercise,
        planType: readiness.planType,
        readiness,
        history,
        date: input.status.date,
        cycleWeek,
        profile: input.profile
      });
      const replacement = candidates.find(
        (other) => other.exercise.id !== candidate.exercise.id
      );
      const fitted = fitExerciseToRemainingTime(
        toGeneratedExercise(candidate, volume, slot.role, replacement?.exercise.id),
        candidate.exercise,
        remainingSeconds
      );
      const candidateDuration = estimateExerciseSeconds(fitted);
      if (candidateDuration <= 0 || usedSeconds + candidateDuration > budgetSeconds) {
        continue;
      }
      selected = candidate;
      generated = fitted;
      durationSeconds = candidateDuration;
      break;
    }

    if (!selected || !generated) {
      avoidedReasons.push(`“${roleLabel(slot.role)}”在剩余时间内无法安全安排`);
      continue;
    }

    exercises.push({
      ...generated,
      estimatedMinutes: roundMinutes(durationSeconds)
    });
    selectedIds.add(selected.exercise.id);
    usedSeconds += durationSeconds;
  }

  const estimatedMinutes = Math.min(input.status.availableMinutes, Math.ceil(usedSeconds / 60));
  const focusLabel = buildFocusLabel(readiness.planType, weeklyCoverage);
  const reasons = [
    ...readiness.triggers,
    `优先补足${roleLabel(getLargestRoleDeficit(weeklyCoverage))}`,
    `按 ${input.status.availableMinutes} 分钟时间预算组合动作`,
    cycleWeek === 5 ? "当前处于第 5 周减载" : "本周按稳定完成情况决定是否进阶"
  ];
  if (input.profile) {
    reasons.push(`已按${fitnessLevelLabel(input.profile.fitnessLevel)}基础和个人器械筛选动作`);
  }

  return {
    date: input.status.date,
    type: readiness.planType,
    timeVersion: readiness.timeVersion,
    templateId: templateIdFor(readiness.planType),
    reason: `${readiness.reason} 动态安排“${focusLabel}”，预计 ${estimatedMinutes} 分钟。`,
    exercises,
    safetyMessage: "训练中腰酸升高 2 分、动作变形、出现麻木或放射痛时立即停止。",
    algorithmVersion: ADAPTIVE_ALGORITHM_VERSION,
    estimatedMinutes,
    decision: {
      readinessScore: readiness.score,
      volumeMultiplier: readiness.volumeMultiplier,
      focusLabel,
      reasons: [...new Set(reasons)],
      avoidedReasons: [...new Set(avoidedReasons)],
      cycleWeek
    }
  };
}

function buildSlotRequests(
  planType: PlanType,
  timeVersion: GeneratedPlan["timeVersion"],
  coverage: Map<ExerciseRole, number>
): SlotRequest[] {
  if (planType === "recovery") {
    const slots: SlotRequest[] = [
      { role: "reset", required: true },
      { role: "conditioning", required: true }
    ];
    if (timeVersion !== "compressed") {
      slots.splice(1, 0, { role: "mobility", required: false });
      slots.push({ role: "core-anti-extension", required: false });
    }
    return slots;
  }

  const primary = getLargestRoleDeficit(coverage, ["upper-pull", "lower-body"]);
  const secondary: ExerciseRole = primary === "upper-pull" ? "lower-body" : "upper-pull";

  if (timeVersion === "compressed") {
    return [
      { role: "reset", required: true },
      { role: primary, required: true },
      { role: "core-anti-extension", required: true }
    ];
  }

  if (planType === "reduced") {
    return [
      { role: "reset", required: true },
      { role: primary, required: true },
      { role: "core-anti-extension", required: true },
      { role: primary === "upper-pull" ? "hip-stability" : "scapular-control", required: false },
      { role: "cooldown", required: false }
    ];
  }

  if (timeVersion === "short") {
    return [
      { role: "reset", required: true },
      { role: primary, required: true },
      { role: secondary, required: true },
      { role: "core-anti-extension", required: true },
      { role: primary === "upper-pull" ? "hip-stability" : "scapular-control", required: false },
      { role: "cooldown", required: false }
    ];
  }

  return [
    { role: "reset", required: true },
    { role: primary, required: true },
    { role: secondary, required: true },
    { role: "scapular-control", required: false },
    { role: "hip-stability", required: false },
    { role: "core-anti-extension", required: true },
    { role: "core-anti-rotation", required: false },
    { role: "conditioning", required: false },
    { role: "cooldown", required: false }
  ];
}

function rankCandidates(input: {
  role: ExerciseRole;
  planType: PlanType;
  status: DailyStatus;
  history: TrainingHistory;
  selectedIds: Set<string>;
  availableEquipment: Set<ExerciseEquipment>;
  weeklyCoverage: Map<ExerciseRole, number>;
  remainingSeconds: number;
  profile?: TrainingProfile;
}): CandidateScore[] {
  return exerciseLibrary
    .map((exercise, libraryIndex) => ({ exercise, libraryIndex }))
    .filter(({ exercise }) => exercise.roles.includes(input.role))
    .filter(({ exercise }) => exercise.allowedPlanTypes.includes(input.planType))
    .filter(({ exercise }) => exercise.equipment.every((item) => input.availableEquipment.has(item)))
    .filter(({ exercise }) => !input.selectedIds.has(exercise.id))
    .filter(({ exercise }) => isExerciseSafe(exercise, input.status, input.planType, input.profile))
    .filter(({ exercise }) => !hasRecentBlockingFeedback(exercise.id, input.history))
    .map(({ exercise, libraryIndex }) => {
      const recentExposure = countRecentExerciseExposure(exercise.id, input.history, 4);
      const recentReplacements = countRecentExerciseReplacements(exercise.id, input.history, 6);
      const lastSessionRepeated = input.history.sessions[0]?.exercises.some(
        (item) => item.exerciseId === exercise.id
      );
      const stableCompletions = countStableCompletions(exercise.id, input.history, 6);
      const roleDeficit = Math.max(0, 3 - (input.weeklyCoverage.get(input.role) ?? 0));
      const estimatedDefaultSeconds = estimateExerciseSeconds(toDefaultGeneratedExercise(exercise));
      const timePenalty = estimatedDefaultSeconds > input.remainingSeconds ? 8 : 0;
      const desiredDifficulty = getDesiredDifficulty(input.status, input.planType, input.profile);
      const difficultyPenalty = Math.abs(exercise.difficulty - desiredDifficulty) * 4;
      const goalScore = getGoalScore(exercise, input.profile);
      const score =
        100 +
        goalScore +
        roleDeficit * 6 +
        stableCompletions * 2 -
        recentExposure * 7 -
        recentReplacements * 12 -
        (lastSessionRepeated ? 12 : 0) -
        difficultyPenalty -
        timePenalty -
        libraryIndex / 100;

      const reasonParts = [`补足${roleLabel(input.role)}`];
      if (exercise.load.lowBack <= 1) reasonParts.push("腰背负担较低");
      if (!lastSessionRepeated) reasonParts.push("避免连续重复");
      if (stableCompletions > 0) reasonParts.push("近期完成稳定");
      if (recentReplacements > 0) reasonParts.push("近期替换记录已降低优先级");

      return {
        exercise,
        score,
        reason: reasonParts.join("；")
      };
    })
    .sort((a, b) => b.score - a.score);
}

function isExerciseSafe(
  exercise: Exercise,
  status: DailyStatus,
  planType: PlanType,
  profile?: TrainingProfile
): boolean {
  if (status.lowBackPain >= 4 && exercise.load.lowBack > 1) return false;
  if (status.lowBackPain >= 3 && exercise.load.lowBack > 2) return false;
  if ((status.neckShoulderPain ?? 0) >= 6 && exercise.load.shoulder > 1) return false;
  if ((status.neckShoulderPain ?? 0) >= 4 && exercise.load.shoulder > 2) return false;
  if (status.energy <= 2 && exercise.difficulty > 2) return false;
  if (planType === "recovery" && (exercise.difficulty > 1 || exercise.load.impact > 1)) return false;
  if (profile?.fitnessLevel === "beginner" && exercise.difficulty > 2) return false;
  if (profile?.ageRange === "60+" && exercise.difficulty > 2) return false;
  if (profile?.limitations.includes("low-back") && exercise.load.lowBack > 1) return false;
  if (profile?.limitations.includes("shoulder") && exercise.load.shoulder > 1) return false;
  if (profile?.limitations.includes("knee") && exercise.load.knee > 1) return false;
  if (profile?.limitations.includes("balance") && exercise.load.balance > 1) return false;
  if (profile && !profile.canChairStand && exercise.roles.includes("lower-body") && exercise.difficulty > 1) {
    return false;
  }
  if (profile && !profile.canHoldSupport20Seconds && ["front-plank", "side-plank"].includes(exercise.id)) {
    return false;
  }
  return true;
}

function hasRecentBlockingFeedback(exerciseId: string, history: TrainingHistory): boolean {
  return history.sessions.slice(0, 6).some((session) =>
    session.exerciseResults.some(
      (result) =>
        result.exerciseId === exerciseId &&
        (result.feedback === "pain" || result.feedback === "technique")
    )
  );
}

function buildVolume(input: {
  exercise: Exercise;
  planType: PlanType;
  readiness: ReadinessResult;
  history: TrainingHistory;
  date: string;
  cycleWeek: number;
  profile?: TrainingProfile;
}): GeneratedVolume {
  const latest = findLatestExercise(input.exercise.id, input.history);
  const latestResult = findLatestExerciseResult(input.exercise.id, input.history);
  const stableWeeks = countStableWeeks(input.exercise.id, input.history, input.date);
  const alreadyAdjustedThisWeek = latest
    ? getWeekStart(latest.session.date) === getWeekStart(input.date)
    : false;
  const adverseFeedback =
    latestResult?.feedback === "fatigue" ||
    latestResult?.feedback === "pain" ||
    latestResult?.feedback === "technique" ||
    latestResult?.completionStatus === "partial" ||
    latestResult?.completionStatus === "skipped";

  let sets = latest?.exercise.sets ?? input.exercise.defaultSets;
  let reps = latest?.exercise.reps ?? input.exercise.defaultReps;
  let seconds = latest?.exercise.seconds ?? input.exercise.defaultSeconds;
  let progressionState: ProgressionState = latest ? "maintain" : "baseline";
  let reason = latest ? "沿用最近稳定训练量" : "从保守默认训练量开始";

  if (!latest && input.profile?.fitnessLevel === "beginner") {
    sets = input.exercise.progression.minSets;
    if (reps !== undefined) reps = Math.max(4, reps - 2);
    if (seconds !== undefined) seconds = Math.max(minimumSeconds(input.exercise), seconds - 5);
    reason = "首次按入门基础量开始";
  }
  if (!latest && input.exercise.id === "brisk-walk" && input.profile && !input.profile.canWalk20Minutes) {
    seconds = 300;
    reason = "快走基础尚未建立，先从 5 分钟开始";
  }

  const adjustment = getAdaptiveProgressionAdjustment({
    currentSets: sets,
    currentReps: reps,
    currentSeconds: seconds,
    stableWeeks,
    currentWeekInCycle: input.cycleWeek,
    lowBackPainMax: getRecentPainMax(input.history),
    adverseFeedback,
    alreadyAdjustedThisWeek,
    repsStep: input.exercise.progression.repsStep,
    secondsStep: input.exercise.progression.secondsStep,
    maxReps: input.exercise.progression.maxReps,
    maxSeconds: input.exercise.progression.maxSeconds,
    maxSets: input.exercise.progression.maxSets,
    minSets: input.exercise.progression.minSets
  });
  sets = adjustment.sets;
  reps = adjustment.reps;
  seconds = adjustment.seconds;
  progressionState = latest ? adjustment.state : adjustment.state === "maintain" ? "baseline" : adjustment.state;
  reason = latest ? adjustment.reason : adjustment.state === "maintain" ? reason : adjustment.reason;

  if (input.planType !== "full") {
    sets = Math.max(
      input.exercise.progression.minSets,
      Math.floor(sets * input.readiness.volumeMultiplier)
    );
    if (reps !== undefined && input.planType === "reduced") reps = Math.max(4, reps - 2);
    if (seconds !== undefined && input.planType === "reduced") {
      seconds = Math.max(minimumSeconds(input.exercise), seconds - 5);
    }
    if (progressionState === "progressed") progressionState = "maintain";
    reason = input.planType === "recovery" ? "恢复日使用最低有效量" : "今日状态一般，降低总量";
  } else if (input.readiness.volumeMultiplier < 1 && progressionState !== "deloaded") {
    sets = Math.max(
      input.exercise.progression.minSets,
      Math.round(sets * input.readiness.volumeMultiplier)
    );
  }

  return { sets, reps, seconds, progressionState, reason };
}

function toGeneratedExercise(
  candidate: CandidateScore,
  volume: GeneratedVolume,
  slot: ExerciseRole,
  replacementId?: string
): GeneratedExercise {
  const exercise = candidate.exercise;
  return {
    exerciseId: exercise.id,
    name: exercise.name,
    sets: volume.sets,
    reps: volume.reps,
    seconds: volume.seconds,
    restSeconds: exercise.restSeconds,
    notes: [...exercise.coachingNotes],
    replacementId,
    stopCondition: exercise.stopCondition,
    videoUrl: exercise.videoUrl,
    videoSource: exercise.videoSource,
    slot,
    selectionReason: `${candidate.reason}；${volume.reason}`,
    progressionState: volume.progressionState
  };
}

function toDefaultGeneratedExercise(exercise: Exercise): GeneratedExercise {
  return {
    exerciseId: exercise.id,
    name: exercise.name,
    sets: exercise.defaultSets,
    reps: exercise.defaultReps,
    seconds: exercise.defaultSeconds,
    restSeconds: exercise.restSeconds,
    notes: [...exercise.coachingNotes],
    replacementId: exercise.replacementId,
    stopCondition: exercise.stopCondition
  };
}

function fitExerciseToRemainingTime(
  exercise: GeneratedExercise,
  source: Exercise,
  remainingSeconds: number
): GeneratedExercise {
  if (remainingSeconds <= 0) return { ...exercise, sets: 0 };
  const next = { ...exercise };

  if (source.id === "brisk-walk" && next.seconds !== undefined) {
    const availableWorkSeconds = Math.max(0, remainingSeconds - 30);
    next.seconds = Math.min(next.seconds, Math.floor(availableWorkSeconds / 60) * 60);
    if (next.seconds < 300) return { ...next, sets: 0 };
  }

  while (estimateExerciseSeconds(next) > remainingSeconds && next.sets > source.progression.minSets) {
    next.sets -= 1;
  }

  while (estimateExerciseSeconds(next) > remainingSeconds && next.reps !== undefined && next.reps > 4) {
    next.reps -= 1;
  }

  const minSeconds = minimumSeconds(source);
  while (
    estimateExerciseSeconds(next) > remainingSeconds &&
    next.seconds !== undefined &&
    next.seconds > minSeconds
  ) {
    next.seconds = Math.max(minSeconds, next.seconds - 5);
  }

  if (estimateExerciseSeconds(next) > remainingSeconds) {
    return { ...next, sets: 0 };
  }
  return next;
}

export function estimateExerciseSeconds(exercise: GeneratedExercise): number {
  if (exercise.sets <= 0) return 0;
  const workPerSet =
    exercise.seconds !== undefined ? exercise.seconds : Math.max(20, (exercise.reps ?? 6) * 3);
  const work = workPerSet * exercise.sets;
  const rest = Math.max(0, exercise.sets - 1) * exercise.restSeconds;
  return work + rest + 30;
}

function findLatestExercise(
  exerciseId: string,
  history: TrainingHistory
): { session: TrainingHistorySession; exercise: GeneratedExercise } | undefined {
  for (const session of history.sessions) {
    const exercise = session.exercises.find((item) => item.exerciseId === exerciseId);
    if (exercise) return { session, exercise };
  }
  return undefined;
}

function findLatestExerciseResult(exerciseId: string, history: TrainingHistory) {
  for (const session of history.sessions) {
    const result = session.exerciseResults.find((item) => item.exerciseId === exerciseId);
    if (result) return result;
  }
  return undefined;
}

function countStableWeeks(exerciseId: string, history: TrainingHistory, currentDate: string): number {
  const currentWeek = getWeekStart(currentDate);
  const weeks = new Map<string, boolean[]>();

  for (const session of history.sessions) {
    const week = getWeekStart(session.date);
    if (week >= currentWeek) continue;
    const exercise = session.exercises.find((item) => item.exerciseId === exerciseId);
    if (!exercise) continue;
    const result = session.exerciseResults.find((item) => item.exerciseId === exerciseId);
    const completionStable = result
      ? result.completionStatus === "completed" && result.feedback === "none"
      : session.completionStatus === "completed";
    const painDelta = getSessionPainDelta(session);
    const painStable = painDelta === undefined || (painDelta <= 1 && (session.lowBackPainAfter ?? 0) < 5);
    const values = weeks.get(week) ?? [];
    values.push(completionStable && painStable);
    weeks.set(week, values);
  }

  const orderedWeeks = [...weeks.entries()]
    .map(([week, values]) => ({ week, stable: values.length > 0 && values.every(Boolean) }))
    .sort((a, b) => b.week.localeCompare(a.week));
  let stableWeeks = 0;
  let previousWeek: string | undefined;
  for (const entry of orderedWeeks) {
    if (!entry.stable) break;
    if (previousWeek && dayDifference(entry.week, previousWeek) !== 7) break;
    stableWeeks += 1;
    previousWeek = entry.week;
  }
  return stableWeeks;
}

function countStableCompletions(exerciseId: string, history: TrainingHistory, limit: number): number {
  return history.sessions.slice(0, limit).filter((session) => {
    const result = session.exerciseResults.find((item) => item.exerciseId === exerciseId);
    if (result) return result.completionStatus === "completed" && result.feedback === "none";
    return (
      session.completionStatus === "completed" &&
      session.exercises.some((item) => item.exerciseId === exerciseId)
    );
  }).length;
}

function countRecentExerciseExposure(exerciseId: string, history: TrainingHistory, limit: number): number {
  return history.sessions
    .slice(0, limit)
    .filter((session) => session.exercises.some((item) => item.exerciseId === exerciseId)).length;
}

function countRecentExerciseReplacements(
  exerciseId: string,
  history: TrainingHistory,
  limit: number
): number {
  return history.sessions
    .slice(0, limit)
    .filter((session) =>
      session.exercises.some((exercise) => exercise.replacedFromId === exerciseId)
    ).length;
}

function getRecentPainMax(history: TrainingHistory): number {
  const values = history.sessions
    .slice(0, 7)
    .map((session) => session.lowBackPainAfter)
    .filter((value): value is number => typeof value === "number");
  return values.length > 0 ? Math.max(...values) : 0;
}

function getRoleCoverage(history: TrainingHistory, currentDate: string, days: number): Map<ExerciseRole, number> {
  const coverage = new Map<ExerciseRole, number>();
  for (const session of history.sessions) {
    const age = dayDifference(session.date, currentDate);
    if (age < 0 || age > days || session.completionStatus === "skipped") continue;
    const seenRoles = new Set<ExerciseRole>();
    for (const exercise of session.exercises) {
      const source = exerciseLibrary.find((item) => item.id === exercise.exerciseId);
      for (const role of source?.roles ?? []) seenRoles.add(role);
    }
    for (const role of seenRoles) coverage.set(role, (coverage.get(role) ?? 0) + 1);
  }
  return coverage;
}

function getLargestRoleDeficit(
  coverage: Map<ExerciseRole, number>,
  roles: ExerciseRole[] = [
    "upper-pull",
    "lower-body",
    "scapular-control",
    "hip-stability",
    "core-anti-extension",
    "core-anti-rotation"
  ]
): ExerciseRole {
  return [...roles].sort((a, b) => {
    const difference = (coverage.get(a) ?? 0) - (coverage.get(b) ?? 0);
    return difference !== 0 ? difference : roles.indexOf(a) - roles.indexOf(b);
  })[0];
}

function buildAvoidedReasons(
  status: DailyStatus,
  history: TrainingHistory,
  readiness: ReadinessResult
): string[] {
  const reasons: string[] = [];
  if (status.lowBackPain >= 4) reasons.push("已排除腰背负担较高的动作");
  if ((status.neckShoulderPain ?? 0) >= 6) reasons.push("已排除肩颈负担较高的动作");
  if (status.energy <= 2) reasons.push("已排除高难度动作");
  if (readiness.timeVersion !== "full") reasons.push("按可用时间减少低优先级槽位");
  if (
    history.sessions.slice(0, 6).some((session) =>
      session.exerciseResults.some(
        (result) => result.feedback === "pain" || result.feedback === "technique"
      )
    )
  ) {
    reasons.push("近期不适或动作控制困难的动作已进入保守冷却");
  }
  return reasons;
}

function buildFocusLabel(planType: PlanType, coverage: Map<ExerciseRole, number>): string {
  if (planType === "recovery") return "恢复 + 低冲击活动";
  if (planType === "reduced") return "轻量全身 + 核心稳定";
  return getLargestRoleDeficit(coverage, ["upper-pull", "lower-body"]) === "upper-pull"
    ? "上背拉力 + 核心稳定"
    : "臀腿稳定 + 上背平衡";
}

function roleLabel(role: ExerciseRole): string {
  const labels: Record<ExerciseRole, string> = {
    reset: "呼吸重置",
    mobility: "活动度",
    "upper-pull": "上肢拉力",
    "scapular-control": "肩胛控制",
    "core-anti-extension": "核心抗伸展",
    "core-anti-rotation": "核心抗旋转",
    "hip-stability": "臀部与骨盆稳定",
    "lower-body": "下肢稳定",
    conditioning: "低冲击有氧",
    cooldown: "收操"
  };
  return labels[role];
}

function templateIdFor(planType: PlanType): GeneratedPlan["templateId"] {
  if (planType === "full") return "adaptive-balanced";
  if (planType === "reduced") return "adaptive-reduced";
  return "recovery";
}

function getDesiredDifficulty(
  status: DailyStatus,
  planType: PlanType,
  profile?: TrainingProfile
): 1 | 2 | 3 {
  if (planType === "recovery") return 1;
  if (
    profile?.fitnessLevel === "beginner" ||
    profile?.ageRange === "60+" ||
    profile?.canChairStand === false ||
    profile?.canHoldSupport20Seconds === false
  ) {
    return planType === "reduced" || status.energy <= 2 ? 1 : 2;
  }
  if (planType === "reduced" || status.energy <= 3) return 2;
  return status.energy >= 5 && status.lowBackPain <= 2 ? 3 : 2;
}

function getGoalScore(exercise: Exercise, profile?: TrainingProfile): number {
  if (!profile || profile.goals.length === 0) return 0;

  return profile.goals.reduce((score, goal) => {
    if (goal === "posture") return score + exercise.goals.posture * 5;
    if (goal === "strength") return score + exercise.goals.strength * 5;
    if (goal === "fat-loss") return score + exercise.goals.fatLoss * 5;
    if (goal === "conditioning") return score + exercise.goals.conditioning * 5;

    const loadTotal =
      exercise.load.lowBack +
      exercise.load.shoulder +
      exercise.load.knee +
      exercise.load.balance +
      exercise.load.impact;
    return score + Math.max(0, 18 - loadTotal * 2 - exercise.difficulty);
  }, 0);
}

function fitnessLevelLabel(level: TrainingProfile["fitnessLevel"]): string {
  if (level === "beginner") return "入门";
  if (level === "experienced") return "进阶";
  return "规律运动";
}

function getCycleWeek(trainingStartDate: string | undefined, currentDate: string): number {
  if (!trainingStartDate) return 1;
  const elapsedWeeks = Math.max(0, Math.floor(dayDifference(trainingStartDate, currentDate) / 7));
  return (elapsedWeeks % 5) + 1;
}

function getWeekStart(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  const day = value.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function dayDifference(earlier: string, later: string): number {
  const start = new Date(`${earlier}T00:00:00Z`).getTime();
  const end = new Date(`${later}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86_400_000);
}

function getSessionPainDelta(session: TrainingHistorySession): number | undefined {
  if (session.lowBackPainBefore === undefined || session.lowBackPainAfter === undefined) {
    return undefined;
  }
  return session.lowBackPainAfter - session.lowBackPainBefore;
}

function minimumSeconds(exercise: Exercise): number {
  return exercise.id === "brisk-walk" ? 300 : 20;
}

function roundMinutes(seconds: number): number {
  return Math.max(1, Math.round((seconds / 60) * 10) / 10);
}
