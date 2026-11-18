import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { describe, expect, it, vi } from "vitest";
import { openAppDatabase } from "../../src/server/db";
import { buildApp } from "../../src/server/app";

describe("adaptive training persistence", () => {
  it("migrates plan metadata and stores action-level feedback", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const cookie = await createAuthenticatedCookie(app);
    await createCheckin(app, cookie, "2026-06-16");

    const columns = await (app as any).db.all("PRAGMA table_info(plans)");
    expect(columns.map((column: { name: string }) => column.name)).toEqual(
      expect.arrayContaining(["algorithm_version", "estimated_minutes", "decision_json"])
    );

    const table = await (app as any).db.get(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'workout_exercise_logs'"
    );
    expect(table.name).toBe("workout_exercise_logs");

    const planResponse = await app.inject({
      method: "POST",
      url: "/api/plans/today",
      headers: { cookie },
      payload: { date: "2026-06-16" }
    });
    expect(planResponse.statusCode).toBe(200);
    const plan = planResponse.json().plan;
    expect(plan.algorithmVersion).toBe("adaptive-v3");
    expect(plan.decision.readinessScore).toBeGreaterThan(0);

    const exerciseResults = plan.exercises.map((exercise: { exerciseId: string }, index: number) => ({
      exerciseId: exercise.exerciseId,
      exerciseIndex: index,
      completionStatus: index === 0 ? "partial" : "completed",
      feedback: index === 0 ? "fatigue" : "none"
    }));
    const workout = await app.inject({
      method: "POST",
      url: `/api/workouts/${plan.id}/complete`,
      headers: { cookie },
      payload: { lowBackPainAfter: 3, exerciseResults }
    });
    expect(workout.statusCode).toBe(200);
    expect(workout.json().workoutLog.completionStatus).toBe("partial");
    expect(workout.json().workoutLog.exerciseResults).toHaveLength(plan.exercises.length);

    const history = await (app as any).repositories.forUser(1).getTrainingHistory("2026-06-17");
    expect(history.sessions).toHaveLength(1);
    expect(history.sessions[0].exerciseResults[0].feedback).toBe("fatigue");

    await app.close();
  });

  it("rejects action feedback that does not match the saved plan", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const cookie = await createAuthenticatedCookie(app);
    await createCheckin(app, cookie, "2026-06-16");

    const planResponse = await app.inject({
      method: "POST",
      url: "/api/plans/today",
      headers: { cookie },
      payload: { date: "2026-06-16" }
    });
    const plan = planResponse.json().plan;

    const invalid = await app.inject({
      method: "POST",
      url: `/api/workouts/${plan.id}/complete`,
      headers: { cookie },
      payload: {
        exerciseResults: [
          {
            exerciseId: "not-in-plan",
            exerciseIndex: 0,
            completionStatus: "completed",
            feedback: "none"
          }
        ]
      }
    });

    expect(invalid.statusCode).toBe(400);
    await app.close();
  });

  it("migrates a legacy plans table without deleting its rows", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "posture-v3-legacy-"));
    const databaseFile = join(tempDir, "legacy.sqlite");
    const legacy = await open({ filename: databaseFile, driver: sqlite3.Database });
    await legacy.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO users (username, password_hash) VALUES ('legacy-owner', 'legacy-hash');
      CREATE TABLE plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        time_version TEXT NOT NULL,
        template_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        exercises_json TEXT NOT NULL,
        safety_message TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO plans (
        date, type, time_version, template_id, reason, exercises_json
      ) VALUES (
        '2026-06-01', 'full', 'full', 'upper-back-core', '旧计划', '[]'
      );
    `);
    await legacy.close();

    const migrated = await openAppDatabase(databaseFile);
    const row = await migrated.get<{
      reason: string;
      user_id: number;
      algorithm_version: string;
      estimated_minutes: number;
      decision_json: string;
    }>("SELECT reason, user_id, algorithm_version, estimated_minutes, decision_json FROM plans");
    expect(row).toEqual({
      reason: "旧计划",
      user_id: 1,
      algorithm_version: "legacy-v1",
      estimated_minutes: 0,
      decision_json: "{}"
    });
    expect(await migrated.all("PRAGMA foreign_key_check")).toEqual([]);
    expect(await migrated.get("PRAGMA integrity_check")).toEqual({ integrity_check: "ok" });
    const backupFiles = await readdir(join(tempDir, "backups"));
    expect(backupFiles.some((file) => file.startsWith("legacy.sqlite.before-multi-user-"))).toBe(true);
    await migrated.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("keeps DeepSeek out after a red flag is reported against an already-recorded plan", async () => {
    const fetchMock = vi.fn(async () => new Response("unexpected"));
    vi.stubGlobal("fetch", fetchMock);
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const cookie = await createAuthenticatedCookie(app);
    await app.inject({
      method: "PUT",
      url: "/api/settings/deepseek-key",
      headers: { cookie },
      payload: { apiKey: "test-api-key-placeholder" }
    });
    await createCheckin(app, cookie, "2026-06-16");
    const planResponse = await app.inject({
      method: "POST",
      url: "/api/plans/today",
      headers: { cookie },
      payload: { date: "2026-06-16" }
    });
    const plan = planResponse.json().plan;
    expect(plan.exercises.length).toBeGreaterThan(0);
    await app.inject({
      method: "POST",
      url: `/api/workouts/${plan.id}/complete`,
      headers: { cookie },
      payload: { completionStatus: "completed", lowBackPainAfter: 2 }
    });

    await app.inject({
      method: "POST",
      url: "/api/checkins",
      headers: { cookie },
      payload: {
        date: "2026-06-16",
        lowBackPain: 2,
        energy: 5,
        availableMinutes: 45,
        redFlags: { radiatingPain: true }
      }
    });

    const explanation = await app.inject({
      method: "POST",
      url: "/api/ai/daily-explanation",
      headers: { cookie },
      payload: { planId: plan.id }
    });
    expect(explanation.json().source).toBe("local");
    expect(explanation.json().fallbackReason).toBe("safety_blocked");
    expect(fetchMock).not.toHaveBeenCalled();

    await app.close();
    vi.unstubAllGlobals();
  });

  it("migrates a version 2 database to version 3 with read_tokens while preserving existing rows", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "posture-v2-to-v3-"));
    const databaseFile = join(tempDir, "v2.sqlite");
    const v2 = await open({ filename: databaseFile, driver: sqlite3.Database });
    await v2.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      INSERT INTO schema_migrations (version) VALUES (2);
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        username_normalized TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT
      );
      CREATE TABLE user_profiles (
        user_id INTEGER PRIMARY KEY,
        age_range TEXT NOT NULL,
        height_cm REAL,
        weight_kg REAL,
        fitness_level TEXT NOT NULL,
        goals_json TEXT NOT NULL,
        equipment_json TEXT NOT NULL,
        weekly_training_days INTEGER NOT NULL,
        default_session_minutes INTEGER NOT NULL,
        can_walk_20_minutes INTEGER NOT NULL,
        can_chair_stand INTEGER NOT NULL,
        can_hold_support_20_seconds INTEGER NOT NULL,
        limitations_json TEXT NOT NULL,
        baseline_low_back_pain INTEGER,
        baseline_neck_shoulder_pain INTEGER,
        onboarding_version TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE user_consents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        consent_type TEXT NOT NULL,
        policy_version TEXT NOT NULL,
        granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at TEXT,
        UNIQUE(user_id, consent_type, policy_version),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE checkins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        low_back_pain INTEGER NOT NULL,
        neck_shoulder_pain INTEGER,
        energy INTEGER NOT NULL,
        available_minutes INTEGER NOT NULL,
        sleep_hours REAL,
        sleep_quality INTEGER,
        steps INTEGER,
        eating_status TEXT,
        weight_kg REAL,
        red_flags_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL,
        time_version TEXT NOT NULL,
        template_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        exercises_json TEXT NOT NULL,
        safety_message TEXT,
        algorithm_version TEXT NOT NULL DEFAULT 'legacy-v1',
        estimated_minutes REAL NOT NULL DEFAULT 0,
        decision_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE workout_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        plan_id INTEGER NOT NULL,
        completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completion_status TEXT NOT NULL,
        notes TEXT,
        low_back_pain_after INTEGER,
        UNIQUE(user_id, plan_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
      );
      CREATE TABLE workout_exercise_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        workout_log_id INTEGER NOT NULL,
        plan_id INTEGER NOT NULL,
        exercise_id TEXT NOT NULL,
        exercise_index INTEGER NOT NULL,
        completion_status TEXT NOT NULL,
        feedback TEXT NOT NULL DEFAULT 'none',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, workout_log_id, exercise_index),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (workout_log_id) REFERENCES workout_logs(id) ON DELETE CASCADE,
        FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
      );
      CREATE TABLE posture_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        photo_date TEXT NOT NULL,
        angle TEXT NOT NULL,
        file_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE plan_exercise_replacements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        plan_id INTEGER NOT NULL,
        original_exercise_id TEXT NOT NULL,
        replacement_exercise_id TEXT NOT NULL,
        original_exercise_json TEXT NOT NULL,
        replaced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reverted_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
      );
      CREATE TABLE settings (
        user_id INTEGER NOT NULL,
        key TEXT NOT NULL,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(user_id, key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      INSERT INTO users (username, username_normalized, password_hash) VALUES ('v2-user', 'v2-user', 'v2-hash');
      INSERT INTO checkins (user_id, date, low_back_pain, neck_shoulder_pain, energy, available_minutes)
      VALUES (1, '2026-10-01', 3, 1, 4, 30);
    `);
    await v2.close();

    const migrated = await openAppDatabase(databaseFile);
    const maxVersion = await migrated.get<{ version: number }>("SELECT MAX(version) AS version FROM schema_migrations");
    expect(maxVersion?.version).toBe(3);
    const table = await migrated.get<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'read_tokens'"
    );
    expect(table?.name).toBe("read_tokens");
    const checkin = await migrated.get<{ date: string; low_back_pain: number }>(
      "SELECT date, low_back_pain FROM checkins WHERE user_id = 1"
    );
    expect(checkin).toEqual({ date: "2026-10-01", low_back_pain: 3 });
    expect(await migrated.all("PRAGMA foreign_key_check")).toEqual([]);
    expect(await migrated.get("PRAGMA integrity_check")).toEqual({ integrity_check: "ok" });

    await migrated.close();
    await rm(tempDir, { recursive: true, force: true });
  });
});

async function createAuthenticatedCookie(app: Awaited<ReturnType<typeof buildApp>>): Promise<string> {
  await app.inject({
    method: "POST",
    url: "/api/auth/setup",
    payload: { username: "adaptive-user", password: "test-password-123" }
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: "adaptive-user", password: "test-password-123" }
  });
  const setCookie = login.headers["set-cookie"];
  const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!rawCookie) throw new Error("Login did not set a cookie.");
  return rawCookie.split(";")[0];
}

async function createCheckin(
  app: Awaited<ReturnType<typeof buildApp>>,
  cookie: string,
  date: string
): Promise<void> {
  await app.inject({
    method: "POST",
    url: "/api/checkins",
    headers: { cookie },
    payload: {
      date,
      lowBackPain: 2,
      energy: 5,
      availableMinutes: 45,
      sleepHours: 7,
      sleepQuality: 4
    }
  });
}
