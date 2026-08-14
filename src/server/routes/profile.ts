import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { TrainingProfile } from "../../core/types";
import { requireAuthenticatedUserId, type SessionStore } from "../auth";
import type { AppDatabase } from "../db";

export const ONBOARDING_VERSION = "2026-08-09-v1";
export const HEALTH_CONSENT_VERSION = "2026-08-09-v1";

const equipmentValues = [
  "bodyweight",
  "floor",
  "pull-up-bar",
  "resistance-band",
  "wall",
  "step",
  "walking-space"
] as const;

const profileSchema = z.object({
  adultConfirmed: z.literal(true),
  healthConsent: z.literal(true),
  ageRange: z.enum(["18-29", "30-44", "45-59", "60+"]),
  heightCm: z.number().min(120).max(230).optional(),
  weightKg: z.number().min(30).max(300).optional(),
  fitnessLevel: z.enum(["beginner", "regular", "experienced"]),
  goals: z.array(z.enum(["safe-movement", "posture", "fat-loss", "strength", "conditioning"]))
    .min(1)
    .max(2)
    .refine((items) => new Set(items).size === items.length),
  equipment: z.array(z.enum(equipmentValues))
    .min(1)
    .refine((items) => new Set(items).size === items.length),
  weeklyTrainingDays: z.number().int().min(1).max(7),
  defaultSessionMinutes: z.number().int().min(5).max(120),
  canWalk20Minutes: z.boolean(),
  canChairStand: z.boolean(),
  canHoldSupport20Seconds: z.boolean(),
  limitations: z.array(z.enum(["low-back", "shoulder", "knee", "balance"]))
    .max(4)
    .refine((items) => new Set(items).size === items.length),
  baselineLowBackPain: z.number().int().min(0).max(10).optional(),
  baselineNeckShoulderPain: z.number().int().min(0).max(10).optional()
});

interface ProfileRouteContext {
  db: AppDatabase;
  sessions: SessionStore;
}

export function registerProfileRoutes(app: FastifyInstance, context: ProfileRouteContext): void {
  app.get("/api/profile", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) return;
    const profile = await getProfile(context.db, userId);
    return { profile };
  });

  app.put("/api/profile", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) return;
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid profile" });
    }

    const profile = parsed.data;
    await context.db.exec("BEGIN IMMEDIATE");
    try {
      await context.db.run(
        `INSERT INTO user_profiles (
          user_id, age_range, height_cm, weight_kg, fitness_level, goals_json,
          equipment_json, weekly_training_days, default_session_minutes,
          can_walk_20_minutes, can_chair_stand, can_hold_support_20_seconds,
          limitations_json, baseline_low_back_pain, baseline_neck_shoulder_pain,
          onboarding_version, completed_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          age_range = excluded.age_range,
          height_cm = excluded.height_cm,
          weight_kg = excluded.weight_kg,
          fitness_level = excluded.fitness_level,
          goals_json = excluded.goals_json,
          equipment_json = excluded.equipment_json,
          weekly_training_days = excluded.weekly_training_days,
          default_session_minutes = excluded.default_session_minutes,
          can_walk_20_minutes = excluded.can_walk_20_minutes,
          can_chair_stand = excluded.can_chair_stand,
          can_hold_support_20_seconds = excluded.can_hold_support_20_seconds,
          limitations_json = excluded.limitations_json,
          baseline_low_back_pain = excluded.baseline_low_back_pain,
          baseline_neck_shoulder_pain = excluded.baseline_neck_shoulder_pain,
          onboarding_version = excluded.onboarding_version,
          completed_at = COALESCE(user_profiles.completed_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP`,
        userId,
        profile.ageRange,
        profile.heightCm ?? null,
        profile.weightKg ?? null,
        profile.fitnessLevel,
        JSON.stringify(profile.goals),
        JSON.stringify(profile.equipment),
        profile.weeklyTrainingDays,
        profile.defaultSessionMinutes,
        Number(profile.canWalk20Minutes),
        Number(profile.canChairStand),
        Number(profile.canHoldSupport20Seconds),
        JSON.stringify(profile.limitations),
        profile.baselineLowBackPain ?? null,
        profile.baselineNeckShoulderPain ?? null,
        ONBOARDING_VERSION
      );
      await context.db.run(
        `INSERT INTO user_consents (user_id, consent_type, policy_version)
         VALUES (?, 'health-data', ?)
         ON CONFLICT(user_id, consent_type, policy_version) DO UPDATE SET
           granted_at = CURRENT_TIMESTAMP,
           revoked_at = NULL`,
        userId,
        HEALTH_CONSENT_VERSION
      );
      await context.db.exec("COMMIT");
    } catch (error) {
      await context.db.exec("ROLLBACK");
      throw error;
    }

    return { profile: await getProfile(context.db, userId) };
  });
}

export async function getProfile(db: AppDatabase, userId: number): Promise<TrainingProfile | null> {
  const row = await db.get<Record<string, unknown>>(
    "SELECT * FROM user_profiles WHERE user_id = ?",
    userId
  );
  if (!row) return null;
  return {
    ageRange: row.age_range as TrainingProfile["ageRange"],
    heightCm: toOptionalNumber(row.height_cm),
    weightKg: toOptionalNumber(row.weight_kg),
    fitnessLevel: row.fitness_level as TrainingProfile["fitnessLevel"],
    goals: JSON.parse(String(row.goals_json)) as TrainingProfile["goals"],
    equipment: JSON.parse(String(row.equipment_json)) as TrainingProfile["equipment"],
    weeklyTrainingDays: Number(row.weekly_training_days),
    defaultSessionMinutes: Number(row.default_session_minutes),
    canWalk20Minutes: Boolean(row.can_walk_20_minutes),
    canChairStand: Boolean(row.can_chair_stand),
    canHoldSupport20Seconds: Boolean(row.can_hold_support_20_seconds),
    limitations: JSON.parse(String(row.limitations_json)) as TrainingProfile["limitations"],
    baselineLowBackPain: toOptionalNumber(row.baseline_low_back_pain) as TrainingProfile["baselineLowBackPain"],
    baselineNeckShoulderPain: toOptionalNumber(row.baseline_neck_shoulder_pain) as TrainingProfile["baselineNeckShoulderPain"],
    onboardingVersion: String(row.onboarding_version),
    completedAt: row.completed_at ? String(row.completed_at) : undefined
  };
}

function toOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
