import type { AppDatabase } from "./db";
import type {
  DailyStatus,
  GeneratedExercise,
  GeneratedPlan,
  TrainingTemplate
} from "../core/types";

export interface AppRepositories {
  db: AppDatabase;
  upsertCheckin: (checkin: DailyStatus) => Promise<CheckinRecord>;
  getCheckinByDate: (date: string) => Promise<CheckinRecord | undefined>;
  getLatestCheckin: () => Promise<CheckinRecord | undefined>;
  listRecentCheckins: (limit?: number) => Promise<CheckinRecord[]>;
  savePlan: (plan: GeneratedPlan) => Promise<StoredPlanRecord>;
  getPlanByDate: (date: string) => Promise<StoredPlanRecord | undefined>;
  getLatestPlan: () => Promise<StoredPlanRecord | undefined>;
  completeWorkout: (input: {
    planId: number;
    completionStatus: string;
    notes?: string;
    lowBackPainAfter?: number;
  }) => Promise<WorkoutLogRecord>;
  countCompletedMainSessionsThisWeek: (date: string) => Promise<number>;
  getLastMainTemplateId: (date: string) => Promise<TrainingTemplate["id"] | undefined>;
  getRecordsSummary: (date: string) => Promise<RecordsSummary>;
  savePhoto: (input: {
    photoDate: string;
    angle: string;
    filePath: string;
    mimeType: string;
  }) => Promise<PhotoRecord>;
  listPhotos: () => Promise<PhotoRecord[]>;
  getPhotoById: (photoId: number) => Promise<PhotoRecord | undefined>;
  getSettings: () => Promise<SettingsRecord>;
  setSettings: (settings: Record<string, unknown>) => Promise<SettingsRecord>;
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
}

export interface PhotoRecord {
  id: number;
  photoDate: string;
  angle: string;
  filePath: string;
  mimeType: string;
  createdAt: string;
}

export interface RecordsSummary {
  checkins: CheckinRecord[];
  weeklyTrainingCount: number;
  progressionRecords: Array<{
    id: number;
    date: string;
    templateId: TrainingTemplate["id"];
    reason: string;
  }>;
}

export interface SettingsRecord {
  notificationsEnabled: boolean;
  deepseekEnabled: boolean;
  [key: string]: unknown;
}

const MAIN_TEMPLATE_IDS: TrainingTemplate["id"][] = ["upper-back-core", "glute-pelvis"];

export function createRepositories(db: AppDatabase): AppRepositories {
  return {
    db,
    upsertCheckin: (checkin) => upsertCheckin(db, checkin),
    getCheckinByDate: (date) => getCheckinByDate(db, date),
    getLatestCheckin: () => getLatestCheckin(db),
    listRecentCheckins: (limit) => listRecentCheckins(db, limit),
    savePlan: (plan) => savePlan(db, plan),
    getPlanByDate: (date) => getPlanByDate(db, date),
    getLatestPlan: () => getLatestPlan(db),
    completeWorkout: (input) => completeWorkout(db, input),
    countCompletedMainSessionsThisWeek: (date) => countCompletedMainSessionsThisWeek(db, date),
    getLastMainTemplateId: (date) => getLastMainTemplateId(db, date),
    getRecordsSummary: (date) => getRecordsSummary(db, date),
    savePhoto: (input) => savePhoto(db, input),
    listPhotos: () => listPhotos(db),
    getPhotoById: (photoId) => getPhotoById(db, photoId),
    getSettings: () => getSettings(db),
    setSettings: (settings) => setSettings(db, settings)
  };
}

async function upsertCheckin(db: AppDatabase, checkin: DailyStatus): Promise<CheckinRecord> {
  await db.run(
    `
      INSERT INTO checkins (
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
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

  const saved = await getCheckinByDate(db, checkin.date);
  if (!saved) {
    throw new Error("Failed to load saved check-in.");
  }

  return saved;
}

async function getCheckinByDate(db: AppDatabase, date: string): Promise<CheckinRecord | undefined> {
  const row = await db.get<CheckinRow>("SELECT * FROM checkins WHERE date = ?", date);
  return row ? mapCheckinRow(row) : undefined;
}

async function getLatestCheckin(db: AppDatabase): Promise<CheckinRecord | undefined> {
  const row = await db.get<CheckinRow>("SELECT * FROM checkins ORDER BY date DESC LIMIT 1");
  return row ? mapCheckinRow(row) : undefined;
}

async function listRecentCheckins(db: AppDatabase, limit = 14): Promise<CheckinRecord[]> {
  const rows = await db.all<CheckinRow[]>(
    "SELECT * FROM checkins ORDER BY date DESC LIMIT ?",
    limit
  );
  return rows.map(mapCheckinRow);
}

async function savePlan(db: AppDatabase, plan: GeneratedPlan): Promise<StoredPlanRecord> {
  await db.run(
    `
      INSERT INTO plans (
        date,
        type,
        time_version,
        template_id,
        reason,
        exercises_json,
        safety_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        type = excluded.type,
        time_version = excluded.time_version,
        template_id = excluded.template_id,
        reason = excluded.reason,
        exercises_json = excluded.exercises_json,
        safety_message = excluded.safety_message
    `,
    plan.date,
    plan.type,
    plan.timeVersion,
    plan.templateId,
    plan.reason,
    JSON.stringify(plan.exercises),
    plan.safetyMessage ?? null
  );

  const saved = await getPlanByDate(db, plan.date);
  if (!saved) {
    throw new Error("Failed to load saved plan.");
  }

  return saved;
}

async function getPlanByDate(db: AppDatabase, date: string): Promise<StoredPlanRecord | undefined> {
  const row = await db.get<PlanRow>("SELECT * FROM plans WHERE date = ?", date);
  return row ? mapPlanRow(row) : undefined;
}

async function getLatestPlan(db: AppDatabase): Promise<StoredPlanRecord | undefined> {
  const row = await db.get<PlanRow>("SELECT * FROM plans ORDER BY date DESC LIMIT 1");
  return row ? mapPlanRow(row) : undefined;
}

async function completeWorkout(
  db: AppDatabase,
  input: {
    planId: number;
    completionStatus: string;
    notes?: string;
    lowBackPainAfter?: number;
  }
): Promise<WorkoutLogRecord> {
  const result = await db.run(
    `
      INSERT INTO workout_logs (
        plan_id,
        completion_status,
        notes,
        low_back_pain_after
      ) VALUES (?, ?, ?, ?)
    `,
    input.planId,
    input.completionStatus,
    input.notes ?? null,
    input.lowBackPainAfter ?? null
  );

  const row = await db.get<WorkoutLogRow>("SELECT * FROM workout_logs WHERE id = ?", result.lastID);
  if (!row) {
    throw new Error("Failed to load workout log.");
  }

  return mapWorkoutLogRow(row);
}

async function countCompletedMainSessionsThisWeek(db: AppDatabase, date: string): Promise<number> {
  const start = getWeekStart(date);
  const row = await db.get<{ count: number }>(
    `
      SELECT COUNT(*) AS count
      FROM workout_logs wl
      JOIN plans p ON p.id = wl.plan_id
      WHERE wl.completion_status = 'completed'
        AND p.template_id IN (${MAIN_TEMPLATE_IDS.map(() => "?").join(", ")})
        AND p.date BETWEEN ? AND ?
    `,
    ...MAIN_TEMPLATE_IDS,
    start,
    date
  );

  return row?.count ?? 0;
}

async function getLastMainTemplateId(
  db: AppDatabase,
  date: string
): Promise<TrainingTemplate["id"] | undefined> {
  const row = await db.get<{ template_id: TrainingTemplate["id"] }>(
    `
      SELECT template_id
      FROM plans
      WHERE date < ?
        AND template_id IN (${MAIN_TEMPLATE_IDS.map(() => "?").join(", ")})
      ORDER BY date DESC
      LIMIT 1
    `,
    date,
    ...MAIN_TEMPLATE_IDS
  );

  return row?.template_id;
}

async function getRecordsSummary(db: AppDatabase, date: string): Promise<RecordsSummary> {
  return {
    checkins: await listRecentCheckins(db, 14),
    weeklyTrainingCount: await countCompletedMainSessionsThisWeek(db, date),
    progressionRecords: await listProgressionRecords(db)
  };
}

async function listProgressionRecords(
  db: AppDatabase
): Promise<RecordsSummary["progressionRecords"]> {
  const rows = await db.all<PlanRow[]>(
    `
      SELECT id, date, template_id, reason
      FROM plans
      ORDER BY date DESC
      LIMIT 10
    `
  );

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    templateId: row.template_id as TrainingTemplate["id"],
    reason: row.reason
  }));
}

async function savePhoto(
  db: AppDatabase,
  input: {
    photoDate: string;
    angle: string;
    filePath: string;
    mimeType: string;
  }
): Promise<PhotoRecord> {
  const result = await db.run(
    `
      INSERT INTO posture_photos (
        photo_date,
        angle,
        file_path,
        mime_type
      ) VALUES (?, ?, ?, ?)
    `,
    input.photoDate,
    input.angle,
    input.filePath,
    input.mimeType
  );

  const row = await db.get<PhotoRow>("SELECT * FROM posture_photos WHERE id = ?", result.lastID);
  if (!row) {
    throw new Error("Failed to load photo record.");
  }

  return mapPhotoRow(row);
}

async function listPhotos(db: AppDatabase): Promise<PhotoRecord[]> {
  const rows = await db.all<PhotoRow[]>("SELECT * FROM posture_photos ORDER BY photo_date DESC, id DESC");
  return rows.map(mapPhotoRow);
}

async function getPhotoById(db: AppDatabase, photoId: number): Promise<PhotoRecord | undefined> {
  const row = await db.get<PhotoRow>("SELECT * FROM posture_photos WHERE id = ?", photoId);
  return row ? mapPhotoRow(row) : undefined;
}

async function getSettings(db: AppDatabase): Promise<SettingsRecord> {
  const rows = await db.all<SettingRow[]>("SELECT * FROM settings");
  const settings: SettingsRecord = {
    notificationsEnabled: false,
    deepseekEnabled: false
  };

  for (const row of rows) {
    settings[row.key] = JSON.parse(row.value_json) as unknown;
  }

  return settings;
}

async function setSettings(db: AppDatabase, settings: Record<string, unknown>): Promise<SettingsRecord> {
  for (const [key, value] of Object.entries(settings)) {
    await db.run(
      `
        INSERT INTO settings (key, value_json)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value_json = excluded.value_json,
          updated_at = CURRENT_TIMESTAMP
      `,
      key,
      JSON.stringify(value)
    );
  }

  return getSettings(db);
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
    templateId: row.template_id as TrainingTemplate["id"],
    reason: row.reason,
    exercises: JSON.parse(row.exercises_json) as GeneratedExercise[],
    safetyMessage: row.safety_message ?? undefined,
    createdAt: row.created_at
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

function mapPhotoRow(row: PhotoRow): PhotoRecord {
  return {
    id: row.id,
    photoDate: row.photo_date,
    angle: row.angle,
    filePath: row.file_path,
    mimeType: row.mime_type,
    createdAt: row.created_at
  };
}

function getWeekStart(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const day = (parsed.getUTCDay() + 6) % 7;
  parsed.setUTCDate(parsed.getUTCDate() - day);
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

interface PhotoRow {
  id: number;
  photo_date: string;
  angle: string;
  file_path: string;
  mime_type: string;
  created_at: string;
}

interface SettingRow {
  key: string;
  value_json: string;
  updated_at: string;
}
