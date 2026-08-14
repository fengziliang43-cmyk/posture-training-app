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
