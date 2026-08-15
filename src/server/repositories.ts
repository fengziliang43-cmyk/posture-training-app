import type { AppDatabase } from "./db";
import { createSecretCipher, type SecretCipher } from "./secrets";
import { exerciseLibrary } from "../core/exercise-library";
import { buildWeeklyReview, type WeeklyReview } from "../core/weekly-review";
import { hasRedFlag } from "../core/readiness";
import type {
  DailyStatus,
  ExerciseCompletionStatus,
  ExerciseFeedback,
  ExerciseResult,
  GeneratedExercise,
  GeneratedPlan,
  PlanTemplateId,
  TrainingProfile,
  TrainingHistory,
  TrainingHistorySession
} from "../core/types";

export interface AppRepositories {
  db: AppDatabase;
  forUser: (userId: number) => UserRepositories;
}

export interface UserRepositories {
  upsertCheckin: (checkin: DailyStatus) => Promise<CheckinRecord>;
  getCheckinByDate: (date: string) => Promise<CheckinRecord | undefined>;
  getLatestCheckin: () => Promise<CheckinRecord | undefined>;
  listRecentCheckins: (limit?: number) => Promise<CheckinRecord[]>;
  savePlan: (plan: GeneratedPlan) => Promise<StoredPlanRecord>;
  getPlanById: (planId: number) => Promise<StoredPlanRecord | undefined>;
  getPlanByDate: (date: string) => Promise<StoredPlanRecord | undefined>;
  getLatestPlan: () => Promise<StoredPlanRecord | undefined>;
  getTrainingHistory: (date: string, days?: number) => Promise<TrainingHistory>;
  replacePlanExercise: (planId: number, exerciseId: string) => Promise<StoredPlanRecord>;
  revertPlanExercise: (planId: number, exerciseId: string) => Promise<StoredPlanRecord>;
  completeWorkout: (input: {
    planId: number;
    completionStatus: ExerciseCompletionStatus;
    notes?: string;
    lowBackPainAfter?: number;
    exerciseResults?: ExerciseResult[];
  }) => Promise<WorkoutLogRecord>;
  countCompletedMainSessionsThisWeek: (date: string) => Promise<number>;
  getLastMainTemplateId: (date: string) => Promise<PlanTemplateId | undefined>;
  getRecordsSummary: (date: string) => Promise<RecordsSummary>;
  savePhoto: (input: {
    photoDate: string;
    angle: string;
    filePath: string;
    mimeType: string;
    note?: string;
  }) => Promise<PhotoRecord>;
  listPhotos: () => Promise<PhotoRecord[]>;
  getPhotoById: (photoId: number) => Promise<PhotoRecord | undefined>;
  updatePhotoNote: (photoId: number, note: string) => Promise<PhotoRecord>;
  getSettings: () => Promise<SettingsRecord>;
  setSettings: (settings: Record<string, unknown>) => Promise<SettingsRecord>;
  getDeepseekApiKey: () => Promise<string | undefined>;
  setDeepseekApiKey: (apiKey: string) => Promise<SettingsRecord>;
  clearDeepseekApiKey: () => Promise<SettingsRecord>;
  updateDeepseekTestStatus: (ok: boolean, checkedAt: string) => Promise<SettingsRecord>;
}

export interface CheckinRecord extends DailyStatus {
  id: number;
  createdAt: string;
}

export interface StoredPlanRecord extends GeneratedPlan {
  id: number;
  createdAt: string;
  exercises: GeneratedExercise[];
}

export interface WorkoutLogRecord {
  id: number;
  planId: number;
  completedAt: string;
  completionStatus: string;
  notes?: string | null;
  lowBackPainAfter?: number | null;
  exerciseResults?: ExerciseResult[];
}

export interface PhotoRecord {
  id: number;
  photoDate: string;
  angle: string;
  filePath: string;
  mimeType: string;
  note?: string | null;
  createdAt: string;
}

export interface RecordsSummary {
  checkins: CheckinRecord[];
  calendarCheckins: CheckinRecord[];
  weeklyReview: WeeklyReview;
  weeklyTrainingCount: number;
  progressionRecords: Array<{
    id: number;
    date: string;
    templateId: PlanTemplateId;
    reason: string;
  }>;
}

export interface SettingsRecord {
  notificationsEnabled: boolean;
  deepseekEnabled: boolean;
  deepseekApiKeyConfigured: boolean;
  deepseekModel: string;
  deepseekLastTestAt?: string;
  deepseekLastTestOk?: boolean;
  [key: string]: unknown;
}

const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
const DEEPSEEK_API_KEY_SETTING = "deepseekApiKey";
const exerciseById = new Map(exerciseLibrary.map((exercise) => [exercise.id, exercise] as const));

export function createRepositories(db: AppDatabase, secretRoot: string): AppRepositories {
  const secretCipher = createSecretCipher(secretRoot);
  return {
    db,
    forUser: (userId) => ({
      upsertCheckin: (checkin) => upsertCheckin(db, userId, checkin),
      getCheckinByDate: (date) => getCheckinByDate(db, userId, date),
      getLatestCheckin: () => getLatestCheckin(db, userId),
      listRecentCheckins: (limit) => listRecentCheckins(db, userId, limit),
      savePlan: (plan) => savePlan(db, userId, plan),
      getPlanById: (planId) => getPlanById(db, userId, planId),
      getPlanByDate: (date) => getPlanByDate(db, userId, date),
      getLatestPlan: () => getLatestPlan(db, userId),
      getTrainingHistory: (date, days) => getTrainingHistory(db, userId, date, days),
      replacePlanExercise: (planId, exerciseId) => replacePlanExercise(db, userId, planId, exerciseId),
      revertPlanExercise: (planId, exerciseId) => revertPlanExercise(db, userId, planId, exerciseId),
      completeWorkout: (input) => completeWorkout(db, userId, input),
      countCompletedMainSessionsThisWeek: (date) => countCompletedMainSessionsThisWeek(db, userId, date),
      getLastMainTemplateId: (date) => getLastMainTemplateId(db, userId, date),
      getRecordsSummary: (date) => getRecordsSummary(db, userId, date),
      savePhoto: (input) => savePhoto(db, userId, input),
      listPhotos: () => listPhotos(db, userId),
      getPhotoById: (photoId) => getPhotoById(db, userId, photoId),
      updatePhotoNote: (photoId, note) => updatePhotoNote(db, userId, photoId, note),
      getSettings: () => getSettings(db, userId, secretCipher),
      setSettings: (settings) => setSettings(db, userId, settings, secretCipher),
      getDeepseekApiKey: () => getDeepseekApiKey(db, userId, secretCipher),
      setDeepseekApiKey: (apiKey) => setDeepseekApiKey(db, userId, apiKey, secretCipher),
      clearDeepseekApiKey: () => clearDeepseekApiKey(db, userId, secretCipher),
      updateDeepseekTestStatus: (ok, checkedAt) => updateDeepseekTestStatus(db, userId, ok, checkedAt, secretCipher)
    })
  };
}

async function upsertCheckin(db: AppDatabase, userId: number, checkin: DailyStatus): Promise<CheckinRecord> {
  await db.run(
    `
      INSERT INTO checkins (
        user_id,
        date,
        low_back_pain,
        neck_shoulder_pain,
        energy,
        available_minutes,
        sleep_hours,
        sleep_quality,
        steps,
        eating_status,
        weight_kg,
        red_flags_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET
        low_back_pain = excluded.low_back_pain,
        neck_shoulder_pain = excluded.neck_shoulder_pain,
        energy = excluded.energy,
        available_minutes = excluded.available_minutes,
        sleep_hours = excluded.sleep_hours,
        sleep_quality = excluded.sleep_quality,
        steps = excluded.steps,
        eating_status = excluded.eating_status,
        weight_kg = excluded.weight_kg,
        red_flags_json = excluded.red_flags_json
    `,
    userId,
    checkin.date,
    checkin.lowBackPain,
    checkin.neckShoulderPain ?? null,
    checkin.energy,
    checkin.availableMinutes,
    checkin.sleepHours ?? null,
    checkin.sleepQuality ?? null,
    checkin.steps ?? null,
    checkin.eatingStatus ?? null,
    checkin.weightKg ?? null,
    checkin.redFlags ? JSON.stringify(checkin.redFlags) : null
  );

  const saved = await getCheckinByDate(db, userId, checkin.date);
  if (!saved) {
    throw new Error("Failed to load saved check-in.");
  }

  return saved;
}

async function getCheckinByDate(
  db: AppDatabase,
  userId: number,
  date: string
): Promise<CheckinRecord | undefined> {
  const row = await db.get<CheckinRow>(
    "SELECT * FROM checkins WHERE user_id = ? AND date = ?",
    userId,
    date
  );
  return row ? mapCheckinRow(row) : undefined;
}

async function getLatestCheckin(db: AppDatabase, userId: number): Promise<CheckinRecord | undefined> {
  const row = await db.get<CheckinRow>(
    "SELECT * FROM checkins WHERE user_id = ? ORDER BY date DESC LIMIT 1",
    userId
  );
  return row ? mapCheckinRow(row) : undefined;
}

async function listRecentCheckins(
  db: AppDatabase,
  userId: number,
  limit = 14
): Promise<CheckinRecord[]> {
  const rows = await db.all<CheckinRow[]>(
    "SELECT * FROM checkins WHERE user_id = ? ORDER BY date DESC LIMIT ?",
    userId,
    limit
  );
  return rows.map(mapCheckinRow);
}

async function savePlan(
  db: AppDatabase,
  userId: number,
  plan: GeneratedPlan
): Promise<StoredPlanRecord> {
  const existing = await getPlanByDate(db, userId, plan.date);
  if (existing) {
    const existingWorkout = await db.get<{ id: number }>(
      "SELECT id FROM workout_logs WHERE user_id = ? AND plan_id = ? LIMIT 1",
      userId,
      existing.id
    );
    if (existingWorkout) {
      return existing;
    }
  }

  await db.run(
    `
      INSERT INTO plans (
        user_id,
        date,
        type,
        time_version,
        template_id,
        reason,
        exercises_json,
        safety_message,
        algorithm_version,
        estimated_minutes,
        decision_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET
        type = excluded.type,
        time_version = excluded.time_version,
        template_id = excluded.template_id,
        reason = excluded.reason,
        exercises_json = excluded.exercises_json,
        safety_message = excluded.safety_message,
        algorithm_version = excluded.algorithm_version,
        estimated_minutes = excluded.estimated_minutes,
        decision_json = excluded.decision_json
    `,
    userId,
    plan.date,
    plan.type,
    plan.timeVersion,
    plan.templateId,
    plan.reason,
    JSON.stringify(plan.exercises),
    plan.safetyMessage ?? null,
    plan.algorithmVersion,
    plan.estimatedMinutes,
    JSON.stringify(plan.decision)
  );

  const saved = await getPlanByDate(db, userId, plan.date);
  if (!saved) {
    throw new Error("Failed to load saved plan.");
  }

  return saved;
}

async function getPlanByDate(
  db: AppDatabase,
  userId: number,
  date: string
): Promise<StoredPlanRecord | undefined> {
  const row = await db.get<PlanRow>(
    "SELECT * FROM plans WHERE user_id = ? AND date = ?",
    userId,
    date
  );
  return row ? mapPlanRow(row) : undefined;
}

async function getPlanById(
  db: AppDatabase,
  userId: number,
  planId: number
): Promise<StoredPlanRecord | undefined> {
  const row = await db.get<PlanRow>(
    "SELECT * FROM plans WHERE user_id = ? AND id = ?",
    userId,
    planId
  );
  return row ? mapPlanRow(row) : undefined;
}

async function getLatestPlan(db: AppDatabase, userId: number): Promise<StoredPlanRecord | undefined> {
  const row = await db.get<PlanRow>(
    "SELECT * FROM plans WHERE user_id = ? ORDER BY date DESC LIMIT 1",
    userId
  );
  return row ? mapPlanRow(row) : undefined;
}

async function getTrainingHistory(
  db: AppDatabase,
  userId: number,
  date: string,
  days = 42
): Promise<TrainingHistory> {
  const startDate = subtractDays(date, days);
  const rows = await db.all<TrainingHistoryRow[]>(
    `
      SELECT
        p.*,
        wl.id AS workout_log_id,
        wl.completion_status AS workout_completion_status,
        wl.low_back_pain_after,
        c.low_back_pain AS low_back_pain_before
      FROM plans p
      JOIN workout_logs wl ON wl.plan_id = p.id
      LEFT JOIN checkins c ON c.user_id = p.user_id AND c.date = p.date
      WHERE p.user_id = ?
        AND wl.user_id = ?
        AND p.date < ?
        AND p.date >= ?
        AND wl.id = (
          SELECT MAX(latest.id)
          FROM workout_logs latest
          WHERE latest.user_id = ? AND latest.plan_id = p.id
        )
      ORDER BY p.date DESC, wl.id DESC
    `,
    userId,
    userId,
    date,
    startDate,
    userId
  );

  const workoutLogIds = rows.map((row) => row.workout_log_id);
  const exerciseRows = workoutLogIds.length
    ? await db.all<WorkoutExerciseLogRow[]>(
        `
          SELECT workout_log_id, exercise_id, exercise_index, completion_status, feedback
          FROM workout_exercise_logs
          WHERE user_id = ?
            AND workout_log_id IN (${workoutLogIds.map(() => "?").join(", ")})
          ORDER BY workout_log_id DESC, exercise_index ASC
        `,
        userId,
        ...workoutLogIds
      )
    : [];
  const resultsByWorkout = new Map<number, ExerciseResult[]>();
  for (const row of exerciseRows) {
    const results = resultsByWorkout.get(row.workout_log_id) ?? [];
    results.push({
      exerciseId: row.exercise_id,
      exerciseIndex: row.exercise_index,
      completionStatus: row.completion_status as ExerciseCompletionStatus,
      feedback: row.feedback as ExerciseFeedback
    });
    resultsByWorkout.set(row.workout_log_id, results);
  }

  const sessions: TrainingHistorySession[] = rows.map((row) => ({
    date: row.date,
    planType: row.type as TrainingHistorySession["planType"],
    templateId: row.template_id as TrainingHistorySession["templateId"],
    exercises: JSON.parse(row.exercises_json) as GeneratedExercise[],
    completionStatus: row.workout_completion_status as ExerciseCompletionStatus,
    lowBackPainBefore: row.low_back_pain_before ?? undefined,
    lowBackPainAfter: row.low_back_pain_after ?? undefined,
    exerciseResults: resultsByWorkout.get(row.workout_log_id) ?? []
  }));

  const startRow = await db.get<{ date: string | null }>(
    `
      SELECT MIN(p.date) AS date
      FROM plans p
      JOIN workout_logs wl ON wl.plan_id = p.id
      WHERE p.user_id = ?
        AND wl.user_id = ?
        AND wl.completion_status IN ('completed', 'partial')
        AND p.type IN ('full', 'reduced')
    `,
    userId,
    userId
  );

  return {
    sessions,
    trainingStartDate: startRow?.date ?? undefined
  };
}

async function replacePlanExercise(
  db: AppDatabase,
  userId: number,
  planId: number,
  exerciseId: string
): Promise<StoredPlanRecord> {
  const plan = await getPlanById(db, userId, planId);
  if (!plan) {
    throw new Error("plan not found");
  }
  await assertPlanEditable(db, userId, plan.id);

  const index = plan.exercises.findIndex((exercise) => exercise.exerciseId === exerciseId);
  if (index < 0) {
    throw new Error("exercise not found");
  }

  const current = plan.exercises[index];
  if (!current.replacementId) {
    throw new Error("replacement not configured");
  }

  const status = await getCheckinByDate(db, userId, plan.date);
  const profile = await getReplacementProfile(db, userId);
  const preferred = exerciseById.get(current.replacementId);
  const replacement = [preferred, ...exerciseLibrary]
    .filter((candidate): candidate is (typeof exerciseLibrary)[number] => Boolean(candidate))
    .find((candidate, candidateIndex, candidates) =>
      candidates.findIndex((item) => item.id === candidate.id) === candidateIndex &&
      candidate.id !== current.exerciseId &&
      candidate.allowedPlanTypes.includes(plan.type) &&
      (!current.slot || candidate.roles.includes(current.slot)) &&
      !plan.exercises.some((exercise, exerciseIndex) =>
        exerciseIndex !== index && exercise.exerciseId === candidate.id
      ) &&
      (!profile || candidate.equipment.every((item) => profile.equipment.includes(item))) &&
      isReplacementSafe(candidate, plan.type, status, profile)
    );
  if (!replacement) {
    throw new Error("no safe replacement is available today");
  }

  if (!isReplacementSafe(replacement, plan.type, status, profile)) {
    throw new Error("replacement is outside today's safety boundary");
  }

  const replacementExercise: GeneratedExercise = {
    exerciseId: replacement.id,
    replacedFromId: current.replacedFromId ?? current.exerciseId,
    name: replacement.name,
    sets: Math.max(1, Math.min(current.sets, replacement.progression.maxSets)),
    reps:
      current.reps === undefined
        ? replacement.defaultReps
        : Math.min(current.reps, replacement.progression.maxReps ?? current.reps),
    seconds:
      current.seconds === undefined
        ? replacement.defaultSeconds
        : Math.min(current.seconds, replacement.progression.maxSeconds ?? current.seconds),
    restSeconds: replacement.restSeconds,
    notes: [...replacement.coachingNotes],
    replacementId: replacement.replacementId,
    stopCondition: replacement.stopCondition,
    videoUrl: replacement.videoUrl,
    videoSource: replacement.videoSource,
    slot: current.slot ?? replacement.roles[0],
    selectionReason: `手动替代为${replacement.name}，保留当天训练量并降低执行门槛`,
    estimatedMinutes: current.estimatedMinutes,
    progressionState: "maintain"
  };

  const nextExercises = [...plan.exercises];
  nextExercises[index] = replacementExercise;

  await db.run(
    `
      INSERT INTO plan_exercise_replacements (
        user_id,
        plan_id,
        original_exercise_id,
        replacement_exercise_id,
        original_exercise_json
      ) VALUES (?, ?, ?, ?, ?)
    `,
    userId,
    plan.id,
    current.replacedFromId ?? current.exerciseId,
    replacement.id,
    JSON.stringify(current)
  );

  await updatePlanExercises(db, userId, plan.id, nextExercises);
  const saved = await getPlanById(db, userId, plan.id);
  if (!saved) {
    throw new Error("Failed to load replaced plan.");
  }
  return saved;
}

function isReplacementSafe(
  replacement: (typeof exerciseLibrary)[number],
  planType: GeneratedPlan["type"],
  status?: CheckinRecord,
  profile?: ReplacementProfile
): boolean {
  if (status?.redFlags && hasRedFlag(status)) return false;
  if (status?.lowBackPain !== undefined && status.lowBackPain >= 4 && replacement.load.lowBack > 1) {
    return false;
  }
  if (
    status?.neckShoulderPain !== undefined &&
    status.neckShoulderPain >= 6 &&
    replacement.load.shoulder > 1
  ) {
    return false;
  }
  if (status?.energy !== undefined && status.energy <= 2 && replacement.difficulty > 2) return false;
  if (planType === "recovery" && replacement.difficulty > 1) return false;
  if (profile?.fitnessLevel === "beginner" && replacement.difficulty > 2) return false;
  if (profile?.ageRange === "60+" && replacement.difficulty > 2) return false;
  if (profile?.limitations.includes("low-back") && replacement.load.lowBack > 1) return false;
  if (profile?.limitations.includes("shoulder") && replacement.load.shoulder > 1) return false;
  if (profile?.limitations.includes("knee") && replacement.load.knee > 1) return false;
  if (profile?.limitations.includes("balance") && replacement.load.balance > 1) return false;
  if (profile && !profile.canChairStand && replacement.roles.includes("lower-body") && replacement.difficulty > 1) {
    return false;
  }
  if (profile && !profile.canHoldSupport20Seconds && ["front-plank", "side-plank"].includes(replacement.id)) {
    return false;
  }
  return true;
}

interface ReplacementProfile {
  ageRange: TrainingProfile["ageRange"];
  fitnessLevel: TrainingProfile["fitnessLevel"];
  equipment: TrainingProfile["equipment"];
  limitations: TrainingProfile["limitations"];
  canChairStand: boolean;
  canHoldSupport20Seconds: boolean;
}

async function getReplacementProfile(
  db: AppDatabase,
  userId: number
): Promise<ReplacementProfile | undefined> {
  const row = await db.get<{
    age_range: string;
    fitness_level: string;
    equipment_json: string;
    limitations_json: string;
    can_chair_stand: number;
    can_hold_support_20_seconds: number;
  }>(
    `SELECT age_range, fitness_level, equipment_json, limitations_json,
            can_chair_stand, can_hold_support_20_seconds
       FROM user_profiles WHERE user_id = ?`,
    userId
  );
  if (!row) return undefined;
  return {
    ageRange: row.age_range as TrainingProfile["ageRange"],
    fitnessLevel: row.fitness_level as TrainingProfile["fitnessLevel"],
    equipment: JSON.parse(row.equipment_json) as TrainingProfile["equipment"],
    limitations: JSON.parse(row.limitations_json) as TrainingProfile["limitations"],
    canChairStand: Boolean(row.can_chair_stand),
    canHoldSupport20Seconds: Boolean(row.can_hold_support_20_seconds)
  };
}

async function revertPlanExercise(
  db: AppDatabase,
  userId: number,
  planId: number,
  exerciseId: string
): Promise<StoredPlanRecord> {
  const plan = await getPlanById(db, userId, planId);
  if (!plan) {
    throw new Error("plan not found");
  }
  await assertPlanEditable(db, userId, plan.id);

  const index = plan.exercises.findIndex((exercise) => exercise.exerciseId === exerciseId);
  if (index < 0) {
    throw new Error("exercise not found");
  }

  const current = plan.exercises[index];
  if (!current.replacedFromId) {
    throw new Error("exercise is not a replacement");
  }

  const log = await db.get<ReplacementRow>(
    `
      SELECT *
      FROM plan_exercise_replacements
      WHERE user_id = ?
        AND plan_id = ?
        AND replacement_exercise_id = ?
        AND reverted_at IS NULL
      ORDER BY replaced_at DESC, id DESC
      LIMIT 1
    `,
    userId,
    plan.id,
    current.exerciseId
  );

  if (!log) {
    throw new Error("replacement log not found");
  }

  const original = JSON.parse(log.original_exercise_json) as GeneratedExercise;
  const nextExercises = [...plan.exercises];
  nextExercises[index] = { ...original, replacedFromId: undefined };

  await db.run(
    "UPDATE plan_exercise_replacements SET reverted_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id = ?",
    userId,
    log.id
  );
  await updatePlanExercises(db, userId, plan.id, nextExercises);

  const saved = await getPlanById(db, userId, plan.id);
  if (!saved) {
    throw new Error("Failed to load reverted plan.");
  }
  return saved;
}

async function assertPlanEditable(db: AppDatabase, userId: number, planId: number): Promise<void> {
  const workout = await db.get<{ id: number }>(
    "SELECT id FROM workout_logs WHERE user_id = ? AND plan_id = ? LIMIT 1",
    userId,
    planId
  );
  if (workout) {
    throw new Error("recorded plan cannot be edited");
  }
}

async function updatePlanExercises(
  db: AppDatabase,
  userId: number,
  planId: number,
  exercises: GeneratedExercise[]
): Promise<void> {
  await db.run(
    "UPDATE plans SET exercises_json = ? WHERE user_id = ? AND id = ?",
    JSON.stringify(exercises),
    userId,
    planId
  );
}

async function completeWorkout(
  db: AppDatabase,
  userId: number,
  input: {
    planId: number;
    completionStatus: ExerciseCompletionStatus;
    notes?: string;
    lowBackPainAfter?: number;
    exerciseResults?: ExerciseResult[];
  }
): Promise<WorkoutLogRecord> {
  const plan = await getPlanById(db, userId, input.planId);
  if (!plan) {
    throw new Error("plan not found");
  }

  if (input.exerciseResults) {
    validateExerciseResults(plan, input.exerciseResults);
  }

  const existing = await db.get<{ id: number }>(
    "SELECT id FROM workout_logs WHERE user_id = ? AND plan_id = ? ORDER BY id DESC LIMIT 1",
    userId,
    input.planId
  );

  await db.exec("BEGIN IMMEDIATE");
  try {
    if (existing) {
      await db.run(
        `
          UPDATE workout_logs
          SET completed_at = CURRENT_TIMESTAMP,
              completion_status = ?,
              notes = ?,
              low_back_pain_after = ?
          WHERE user_id = ? AND id = ?
        `,
        input.completionStatus,
        input.notes ?? null,
        input.lowBackPainAfter ?? null,
        userId,
        existing.id
      );
    } else {
      await db.run(
        `
          INSERT INTO workout_logs (
            user_id,
            plan_id,
            completion_status,
            notes,
            low_back_pain_after
          ) VALUES (?, ?, ?, ?, ?)
        `,
        userId,
        input.planId,
        input.completionStatus,
        input.notes ?? null,
        input.lowBackPainAfter ?? null
      );
    }

    const workoutLog = await db.get<{ id: number }>(
      "SELECT id FROM workout_logs WHERE user_id = ? AND plan_id = ? ORDER BY id DESC LIMIT 1",
      userId,
      input.planId
    );
    if (!workoutLog) {
      throw new Error("Failed to load saved workout log.");
    }

    if (input.exerciseResults) {
      await db.run(
        "DELETE FROM workout_exercise_logs WHERE user_id = ? AND workout_log_id = ?",
        userId,
        workoutLog.id
      );
      for (const result of input.exerciseResults) {
        await db.run(
          `
            INSERT INTO workout_exercise_logs (
              user_id,
              workout_log_id,
              plan_id,
              exercise_id,
              exercise_index,
              completion_status,
              feedback
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          userId,
          workoutLog.id,
          input.planId,
          result.exerciseId,
          result.exerciseIndex,
          result.completionStatus,
          result.feedback
        );
      }
    }

    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }

  const row = await db.get<WorkoutLogRow>(
    "SELECT * FROM workout_logs WHERE user_id = ? AND plan_id = ? ORDER BY id DESC LIMIT 1",
    userId,
    input.planId
  );
  if (!row) {
    throw new Error("Failed to load workout log.");
  }

  const exerciseRows = await db.all<WorkoutExerciseLogRow[]>(
    `
      SELECT workout_log_id, exercise_id, exercise_index, completion_status, feedback
      FROM workout_exercise_logs
      WHERE user_id = ? AND workout_log_id = ?
      ORDER BY exercise_index ASC
    `,
    userId,
    row.id
  );

  return {
    ...mapWorkoutLogRow(row),
    exerciseResults: exerciseRows.map(mapExerciseResultRow)
  };
}

function validateExerciseResults(plan: StoredPlanRecord, results: ExerciseResult[]): void {
  if (results.length !== plan.exercises.length) {
    throw new Error("invalid exercise results: must cover the whole plan");
  }

  const indexes = new Set<number>();
  for (const result of results) {
    if (indexes.has(result.exerciseIndex)) {
      throw new Error("invalid exercise results: duplicate index");
    }
    indexes.add(result.exerciseIndex);
    const expected = plan.exercises[result.exerciseIndex];
    if (!expected || expected.exerciseId !== result.exerciseId) {
      throw new Error("invalid exercise results: does not match plan");
    }
  }
}

async function countCompletedMainSessionsThisWeek(
  db: AppDatabase,
  userId: number,
  date: string
): Promise<number> {
  const start = getWeekStart(date);
  const row = await db.get<{ count: number }>(
    `
      SELECT COUNT(*) AS count
      FROM workout_logs wl
      JOIN plans p ON p.id = wl.plan_id
      WHERE p.user_id = ?
        AND wl.user_id = ?
        AND wl.completion_status = 'completed'
        AND p.type IN ('full', 'reduced')
        AND p.date BETWEEN ? AND ?
    `,
    userId,
    userId,
    start,
    date
  );

  return row?.count ?? 0;
}

async function getLastMainTemplateId(
  db: AppDatabase,
  userId: number,
  date: string
): Promise<PlanTemplateId | undefined> {
  const row = await db.get<{ template_id: PlanTemplateId }>(
    `
      SELECT template_id
      FROM plans
      WHERE user_id = ?
        AND date < ?
        AND type IN ('full', 'reduced')
      ORDER BY date DESC
      LIMIT 1
    `,
    userId,
    date
  );

  return row?.template_id;
}

async function getRecordsSummary(
  db: AppDatabase,
  userId: number,
  date: string
): Promise<RecordsSummary> {
  return {
    checkins: await listRecentCheckins(db, userId, 14),
    calendarCheckins: await listMonthCheckins(db, userId, date),
    weeklyReview: await getWeeklyReview(db, userId, date),
    weeklyTrainingCount: await countCompletedMainSessionsThisWeek(db, userId, date),
    progressionRecords: await listProgressionRecords(db, userId)
  };
}

async function getWeeklyReview(db: AppDatabase, userId: number, date: string): Promise<WeeklyReview> {
  const start = getWeekStart(date);
  const checkinRows = await db.all<CheckinRow[]>(
    `
      SELECT *
      FROM checkins
      WHERE user_id = ? AND date BETWEEN ? AND ?
      ORDER BY date ASC
    `,
    userId,
    start,
    date
  );
  const countRow = await db.get<{ completed: number; completed_main: number }>(
    `
      SELECT
        COUNT(wl.id) AS completed,
        SUM(CASE WHEN p.type IN ('full', 'reduced') THEN 1 ELSE 0 END) AS completed_main
      FROM workout_logs wl
      JOIN plans p ON p.id = wl.plan_id
      WHERE p.user_id = ?
        AND wl.user_id = ?
        AND wl.completion_status = 'completed'
        AND p.date BETWEEN ? AND ?
    `,
    userId,
    userId,
    start,
    date
  );
  const painRows = await db.all<Array<{ low_back_pain_after: number | null }>>(
    `
      SELECT wl.low_back_pain_after
      FROM workout_logs wl
      JOIN plans p ON p.id = wl.plan_id
      WHERE p.user_id = ?
        AND wl.user_id = ?
        AND wl.low_back_pain_after IS NOT NULL
        AND p.date BETWEEN ? AND ?
    `,
    userId,
    userId,
    start,
    date
  );

  return buildWeeklyReview({
    weekStart: start,
    weekEnd: date,
    checkins: checkinRows.map(mapCheckinRow),
    completedWorkouts: countRow?.completed ?? 0,
    completedMainWorkouts: countRow?.completed_main ?? 0,
    painAfterValues: painRows
      .map((row) => row.low_back_pain_after)
      .filter((value): value is number => typeof value === "number")
  });
}

async function listMonthCheckins(
  db: AppDatabase,
  userId: number,
  date: string
): Promise<CheckinRecord[]> {
  const { start, end } = monthRange(date);
  const rows = await db.all<CheckinRow[]>(
    `
      SELECT *
      FROM checkins
      WHERE user_id = ? AND date BETWEEN ? AND ?
      ORDER BY date ASC
    `,
    userId,
    start,
    end
  );
  return rows.map(mapCheckinRow);
}

async function listProgressionRecords(
  db: AppDatabase,
  userId: number
): Promise<RecordsSummary["progressionRecords"]> {
  const rows = await db.all<PlanRow[]>(
    `
    SELECT id, date, template_id, reason
      FROM plans
      WHERE user_id = ?
      ORDER BY date DESC
      LIMIT 10
    `,
    userId
  );

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    templateId: row.template_id as PlanTemplateId,
    reason: row.reason
  }));
}

async function savePhoto(
  db: AppDatabase,
  userId: number,
  input: {
    photoDate: string;
    angle: string;
    filePath: string;
    mimeType: string;
    note?: string;
  }
): Promise<PhotoRecord> {
  const result = await db.run(
    `
      INSERT INTO posture_photos (
        user_id,
        photo_date,
        angle,
        file_path,
        mime_type,
        note
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    userId,
    input.photoDate,
    input.angle,
    input.filePath,
    input.mimeType,
    input.note ?? null
  );

  const row = await db.get<PhotoRow>(
    "SELECT * FROM posture_photos WHERE user_id = ? AND id = ?",
    userId,
    result.lastID
  );
  if (!row) {
    throw new Error("Failed to load photo record.");
  }

  return mapPhotoRow(row);
}

async function listPhotos(db: AppDatabase, userId: number): Promise<PhotoRecord[]> {
  const rows = await db.all<PhotoRow[]>(
    "SELECT * FROM posture_photos WHERE user_id = ? ORDER BY photo_date DESC, id DESC",
    userId
  );
  return rows.map(mapPhotoRow);
}

async function getPhotoById(
  db: AppDatabase,
  userId: number,
  photoId: number
): Promise<PhotoRecord | undefined> {
  const row = await db.get<PhotoRow>(
    "SELECT * FROM posture_photos WHERE user_id = ? AND id = ?",
    userId,
    photoId
  );
  return row ? mapPhotoRow(row) : undefined;
}

async function updatePhotoNote(
  db: AppDatabase,
  userId: number,
  photoId: number,
  note: string
): Promise<PhotoRecord> {
  await db.run(
    "UPDATE posture_photos SET note = ? WHERE user_id = ? AND id = ?",
    note.trim() || null,
    userId,
    photoId
  );
  const photo = await getPhotoById(db, userId, photoId);
  if (!photo) {
    throw new Error("photo not found");
  }
  return photo;
}

async function getSettings(
  db: AppDatabase,
  userId: number,
  secretCipher: SecretCipher
): Promise<SettingsRecord> {
  const rows = await db.all<SettingRow[]>(
    "SELECT * FROM settings WHERE user_id = ?",
    userId
  );
  const settings: SettingsRecord = {
    notificationsEnabled: false,
    deepseekEnabled: false,
    deepseekApiKeyConfigured: false,
    deepseekModel: DEFAULT_DEEPSEEK_MODEL
  };

  for (const row of rows) {
    if (row.key === DEEPSEEK_API_KEY_SETTING) {
      settings.deepseekApiKeyConfigured = Boolean(JSON.parse(row.value_json));
      continue;
    }
    settings[row.key] = JSON.parse(row.value_json) as unknown;
  }

  settings.deepseekApiKeyConfigured = Boolean(await getDeepseekApiKey(db, userId, secretCipher));
  if (typeof settings.deepseekModel !== "string" || settings.deepseekModel.length === 0) {
    settings.deepseekModel = DEFAULT_DEEPSEEK_MODEL;
  }

  return settings;
}

async function setSettings(
  db: AppDatabase,
  userId: number,
  settings: Record<string, unknown>,
  secretCipher: SecretCipher
): Promise<SettingsRecord> {
  for (const [key, value] of Object.entries(settings)) {
    if (key === DEEPSEEK_API_KEY_SETTING || key === "deepseekApiKeyConfigured") {
      continue;
    }
    if (value === undefined) {
      continue;
    }
    await db.run(
      `
        INSERT INTO settings (user_id, key, value_json)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, key) DO UPDATE SET
          value_json = excluded.value_json,
          updated_at = CURRENT_TIMESTAMP
      `,
      userId,
      key,
      JSON.stringify(value)
    );
  }

  return getSettings(db, userId, secretCipher);
}

async function getDeepseekApiKey(
  db: AppDatabase,
  userId: number,
  secretCipher: SecretCipher
): Promise<string | undefined> {
  const row = await db.get<SettingRow>(
    "SELECT * FROM settings WHERE user_id = ? AND key = ?",
    userId,
    DEEPSEEK_API_KEY_SETTING
  );
  if (!row) return undefined;
  const value = JSON.parse(row.value_json) as unknown;
  if (typeof value !== "string" || value.length === 0) return undefined;

  if (!secretCipher.isSealed(value)) {
    await setRawSetting(db, userId, DEEPSEEK_API_KEY_SETTING, secretCipher.seal(value));
    return value;
  }

  try {
    return secretCipher.open(value);
  } catch {
    return undefined;
  }
}

async function setDeepseekApiKey(
  db: AppDatabase,
  userId: number,
  apiKey: string,
  secretCipher: SecretCipher
): Promise<SettingsRecord> {
  const normalized = apiKey.trim();
  if (!normalized) {
    return clearDeepseekApiKey(db, userId, secretCipher);
  }

  await setRawSetting(db, userId, DEEPSEEK_API_KEY_SETTING, secretCipher.seal(normalized));
  return setSettings(
    db,
    userId,
    { deepseekEnabled: true, deepseekModel: DEFAULT_DEEPSEEK_MODEL },
    secretCipher
  );
}

async function clearDeepseekApiKey(
  db: AppDatabase,
  userId: number,
  secretCipher: SecretCipher
): Promise<SettingsRecord> {
  await db.run(
    "DELETE FROM settings WHERE user_id = ? AND key = ?",
    userId,
    DEEPSEEK_API_KEY_SETTING
  );
  await setSettings(db, userId, { deepseekEnabled: false }, secretCipher);
  return getSettings(db, userId, secretCipher);
}

async function updateDeepseekTestStatus(
  db: AppDatabase,
  userId: number,
  ok: boolean,
  checkedAt: string,
  secretCipher: SecretCipher
): Promise<SettingsRecord> {
  return setSettings(
    db,
    userId,
    {
      deepseekLastTestOk: ok,
      deepseekLastTestAt: checkedAt
    },
    secretCipher
  );
}

async function setRawSetting(
  db: AppDatabase,
  userId: number,
  key: string,
  value: unknown
): Promise<void> {
  await db.run(
    `
      INSERT INTO settings (user_id, key, value_json)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = CURRENT_TIMESTAMP
    `,
    userId,
    key,
    JSON.stringify(value)
  );
}

function mapCheckinRow(row: CheckinRow): CheckinRecord {
  return {
    id: row.id,
    date: row.date,
    lowBackPain: row.low_back_pain as DailyStatus["lowBackPain"],
    neckShoulderPain:
      row.neck_shoulder_pain === null
        ? undefined
        : (row.neck_shoulder_pain as DailyStatus["neckShoulderPain"]),
    energy: row.energy as DailyStatus["energy"],
    availableMinutes: row.available_minutes,
    sleepHours: row.sleep_hours ?? undefined,
    sleepQuality:
      row.sleep_quality === null ? undefined : (row.sleep_quality as DailyStatus["sleepQuality"]),
    steps: row.steps ?? undefined,
    eatingStatus: row.eating_status === null ? undefined : (row.eating_status as DailyStatus["eatingStatus"]),
    weightKg: row.weight_kg ?? undefined,
    redFlags: row.red_flags_json ? (JSON.parse(row.red_flags_json) as DailyStatus["redFlags"]) : undefined,
    createdAt: row.created_at
  };
}

function mapPlanRow(row: PlanRow): StoredPlanRecord {
  return {
    id: row.id,
    date: row.date,
    type: row.type as GeneratedPlan["type"],
    timeVersion: row.time_version as GeneratedPlan["timeVersion"],
    templateId: row.template_id as PlanTemplateId,
    reason: row.reason,
    exercises: JSON.parse(row.exercises_json) as GeneratedExercise[],
    safetyMessage: row.safety_message ?? undefined,
    algorithmVersion: row.algorithm_version ?? "legacy-v1",
    estimatedMinutes: row.estimated_minutes ?? 0,
    decision: parsePlanDecision(row.decision_json, row.reason),
    createdAt: row.created_at
  };
}

function parsePlanDecision(value: string | null | undefined, reason: string) {
  if (value) {
    try {
      const parsed = JSON.parse(value) as StoredPlanRecord["decision"];
      if (
        typeof parsed.readinessScore === "number" &&
        typeof parsed.volumeMultiplier === "number" &&
        typeof parsed.focusLabel === "string" &&
        Array.isArray(parsed.reasons) &&
        Array.isArray(parsed.avoidedReasons) &&
        typeof parsed.cycleWeek === "number"
      ) {
        return parsed;
      }
    } catch {
      // Legacy or malformed decision data falls back to a safe neutral summary.
    }
  }

  return {
    readinessScore: 0,
    volumeMultiplier: 1,
    focusLabel: "历史计划",
    reasons: [reason],
    avoidedReasons: [],
    cycleWeek: 1
  };
}

function monthRange(date: string): { start: string; end: string } {
  const month = date.slice(0, 7);
  const [yearValue, monthValue] = month.split("-").map(Number);
  const lastDay = new Date(yearValue, monthValue, 0).getDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, "0")}`
  };
}

function mapWorkoutLogRow(row: WorkoutLogRow): WorkoutLogRecord {
  return {
    id: row.id,
    planId: row.plan_id,
    completedAt: row.completed_at,
    completionStatus: row.completion_status,
    notes: row.notes ?? undefined,
    lowBackPainAfter: row.low_back_pain_after ?? undefined
  };
}

function mapExerciseResultRow(row: WorkoutExerciseLogRow): ExerciseResult {
  return {
    exerciseId: row.exercise_id,
    exerciseIndex: row.exercise_index,
    completionStatus: row.completion_status as ExerciseCompletionStatus,
    feedback: row.feedback as ExerciseFeedback
  };
}

function mapPhotoRow(row: PhotoRow): PhotoRecord {
  return {
    id: row.id,
    photoDate: row.photo_date,
    angle: row.angle,
    filePath: row.file_path,
    mimeType: row.mime_type,
    note: row.note ?? undefined,
    createdAt: row.created_at
  };
}

function getWeekStart(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const day = (parsed.getUTCDay() + 6) % 7;
  parsed.setUTCDate(parsed.getUTCDate() - day);
  return parsed.toISOString().slice(0, 10);
}

function subtractDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() - days);
  return parsed.toISOString().slice(0, 10);
}

interface CheckinRow {
  id: number;
  date: string;
  low_back_pain: number;
  neck_shoulder_pain: number | null;
  energy: number;
  available_minutes: number;
  sleep_hours: number | null;
  sleep_quality: number | null;
  steps: number | null;
  eating_status: string | null;
  weight_kg: number | null;
  red_flags_json: string | null;
  created_at: string;
}

interface PlanRow {
  id: number;
  date: string;
  type: string;
  time_version: string;
  template_id: string;
  reason: string;
  exercises_json: string;
  safety_message: string | null;
  algorithm_version: string | null;
  estimated_minutes: number | null;
  decision_json: string | null;
  created_at: string;
}

interface WorkoutLogRow {
  id: number;
  plan_id: number;
  completed_at: string;
  completion_status: string;
  notes: string | null;
  low_back_pain_after: number | null;
}

interface WorkoutExerciseLogRow {
  workout_log_id: number;
  exercise_id: string;
  exercise_index: number;
  completion_status: string;
  feedback: string;
}

interface TrainingHistoryRow extends PlanRow {
  workout_log_id: number;
  workout_completion_status: string;
  low_back_pain_after: number | null;
  low_back_pain_before: number | null;
}

interface PhotoRow {
  id: number;
  photo_date: string;
  angle: string;
  file_path: string;
  mime_type: string;
  note: string | null;
  created_at: string;
}

interface SettingRow {
  key: string;
  value_json: string;
  updated_at: string;
}

interface ReplacementRow {
  id: number;
  plan_id: number;
  original_exercise_id: string;
  replacement_exercise_id: string;
  original_exercise_json: string;
  replaced_at: string;
  reverted_at: string | null;
}
