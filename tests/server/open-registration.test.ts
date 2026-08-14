import { describe, expect, it } from "vitest";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "../../src/server/app";

describe("open registration and onboarding", () => {
  it("advertises registration availability in development", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const response = await app.inject({ method: "GET", url: "/api/auth/capabilities" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ registrationEnabled: true });
    await app.close();
  });

  it("rejects browser origins outside the allowlist", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      headers: { origin: "https://evil.example" },
      payload: {
        username: "blocked-user",
        password: "strong-password-123",
        adultConfirmed: true,
        termsAccepted: true
      }
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("registers without an invite, requires onboarding, then creates a video-backed plan", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const registration = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        username: "new-user",
        password: "strong-password-123",
        adultConfirmed: true,
        termsAccepted: true
      }
    });

    expect(registration.statusCode).toBe(200);
    expect(registration.json().user.onboardingCompleted).toBe(false);
    expect(registration.json().sessionToken).toBeUndefined();
    const cookie = getCookie(registration.headers["set-cookie"]);

    const checkinBeforeConsent = await app.inject({
      method: "POST",
      url: "/api/checkins",
      headers: { cookie },
      payload: checkinPayload("2026-08-09")
    });
    expect(checkinBeforeConsent.statusCode).toBe(409);
    expect(checkinBeforeConsent.json().code).toBe("ONBOARDING_REQUIRED");

    const profile = await app.inject({
      method: "PUT",
      url: "/api/profile",
      headers: { cookie },
      payload: profilePayload()
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json().profile.completedAt).toBeTypeOf("string");

    const checkin = await app.inject({
      method: "POST",
      url: "/api/checkins",
      headers: { cookie },
      payload: checkinPayload("2026-08-09")
    });
    expect(checkin.statusCode).toBe(200);

    const plan = await app.inject({
      method: "POST",
      url: "/api/plans/today",
      headers: { cookie },
      payload: { date: "2026-08-09" }
    });
    expect(plan.statusCode).toBe(200);
    expect(plan.json().plan.exercises.length).toBeGreaterThan(0);
    for (const exercise of plan.json().plan.exercises) {
      expect(exercise.videoUrl).toMatch(/^https:\/\/www\.bilibili\.com\/video\//);
    }

    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    expect(me.json().user.onboardingCompleted).toBe(true);

    const duplicate = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        username: "NEW-USER",
        password: "another-password-123",
        adultConfirmed: true,
        termsAccepted: true
      }
    });
    expect(duplicate.statusCode).toBe(409);

    const row = await (app as any).db.get(
      "SELECT password_hash FROM users WHERE username_normalized = ?",
      "new-user"
    );
    expect(row.password_hash).not.toContain("strong-password-123");
    await app.close();
  });

  it("isolates check-ins and same-date plans between registered users", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const userA = await registerAndOnboard(app, "user-a");
    const userB = await registerAndOnboard(app, "user-b");

    await app.inject({
      method: "POST",
      url: "/api/checkins",
      headers: { cookie: userA.cookie },
      payload: { ...checkinPayload("2026-08-09"), lowBackPain: 1 }
    });
    await app.inject({
      method: "POST",
      url: "/api/checkins",
      headers: { cookie: userB.cookie },
      payload: { ...checkinPayload("2026-08-09"), lowBackPain: 4 }
    });

    const planA = await app.inject({
      method: "POST",
      url: "/api/plans/today",
      headers: { cookie: userA.cookie },
      payload: { date: "2026-08-09" }
    });
    const planB = await app.inject({
      method: "POST",
      url: "/api/plans/today",
      headers: { cookie: userB.cookie },
      payload: { date: "2026-08-09" }
    });
    expect(planA.statusCode).toBe(200);
    expect(planB.statusCode).toBe(200);
    expect(planA.json().plan.id).not.toBe(planB.json().plan.id);

    const recentA = await app.inject({
      method: "GET",
      url: "/api/checkins/recent",
      headers: { cookie: userA.cookie }
    });
    const recentB = await app.inject({
      method: "GET",
      url: "/api/checkins/recent",
      headers: { cookie: userB.cookie }
    });
    expect(recentA.json().checkins).toHaveLength(1);
    expect(recentA.json().checkins[0].lowBackPain).toBe(1);
    expect(recentB.json().checkins).toHaveLength(1);
    expect(recentB.json().checkins[0].lowBackPain).toBe(4);

    const crossUserWorkout = await app.inject({
      method: "POST",
      url: `/api/workouts/${planA.json().plan.id}/complete`,
      headers: { cookie: userB.cookie },
      payload: { completionStatus: "completed" }
    });
    expect(crossUserWorkout.statusCode).toBe(404);

    const rowCounts = await (app as any).db.all(
      "SELECT user_id, COUNT(*) AS count FROM plans GROUP BY user_id ORDER BY user_id"
    );
    expect(rowCounts).toEqual([
      { user_id: userA.id, count: 1 },
      { user_id: userB.id, count: 1 }
    ]);

    await app.close();
  });

  it("requires password confirmation and cascades account deletion", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "zixu-delete-account-"));
    const uploadDir = join(tempDir, "uploads");
    const app = await buildApp({ databaseFile: ":memory:", uploadDir });
    const user = await registerAndOnboard(app, "delete-me");
    await app.inject({
      method: "POST",
      url: "/api/checkins",
      headers: { cookie: user.cookie },
      payload: checkinPayload("2026-08-09")
    });
    await app.inject({
      method: "POST",
      url: "/api/plans/today",
      headers: { cookie: user.cookie },
      payload: { date: "2026-08-09" }
    });
    const photoDir = join(uploadDir, String(user.id));
    const photoPath = join(photoDir, "private-photo.jpg");
    await mkdir(photoDir, { recursive: true });
    await writeFile(photoPath, "private-photo");
    await (app as any).repositories.forUser(user.id).savePhoto({
      photoDate: "2026-08-09",
      angle: "front",
      filePath: `${user.id}/private-photo.jpg`,
      mimeType: "image/jpeg"
    });

    const rejected = await app.inject({
      method: "DELETE",
      url: "/api/account",
      headers: { cookie: user.cookie },
      payload: { password: "wrong-password", confirmation: "delete-me" }
    });
    expect(rejected.statusCode).toBe(400);

    const deleted = await app.inject({
      method: "DELETE",
      url: "/api/account",
      headers: { cookie: user.cookie },
      payload: { password: "strong-password-123", confirmation: "delete-me" }
    });
    expect(deleted.statusCode).toBe(200);

    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: user.cookie } });
    expect(me.statusCode).toBe(401);
    for (const table of ["users", "user_profiles", "user_consents", "sessions", "checkins", "plans"]) {
      const row = await (app as any).db.get(`SELECT COUNT(*) AS count FROM ${table}`);
      expect(row.count).toBe(0);
    }
    await expect(access(photoPath)).rejects.toThrow();

    await app.close();
    await rm(tempDir, { recursive: true, force: true });
  });
});

async function registerAndOnboard(
  app: Awaited<ReturnType<typeof buildApp>>,
  username: string
): Promise<{ id: number; cookie: string }> {
  const registration = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      username,
      password: "strong-password-123",
      adultConfirmed: true,
      termsAccepted: true
    }
  });
  expect(registration.statusCode).toBe(200);
  const cookie = getCookie(registration.headers["set-cookie"]);
  const profile = await app.inject({
    method: "PUT",
    url: "/api/profile",
    headers: { cookie },
    payload: profilePayload()
  });
  expect(profile.statusCode).toBe(200);
  return { id: registration.json().user.id, cookie };
}

function profilePayload() {
  return {
    adultConfirmed: true,
    healthConsent: true,
    ageRange: "30-44",
    heightCm: 172,
    weightKg: 68,
    fitnessLevel: "beginner",
    goals: ["safe-movement", "posture"],
    equipment: ["bodyweight", "floor", "wall", "walking-space"],
    weeklyTrainingDays: 3,
    defaultSessionMinutes: 30,
    canWalk20Minutes: true,
    canChairStand: true,
    canHoldSupport20Seconds: true,
    limitations: [],
    baselineLowBackPain: 1,
    baselineNeckShoulderPain: 1
  };
}

function checkinPayload(date: string) {
  return {
    date,
    lowBackPain: 2,
    neckShoulderPain: 1,
    energy: 4,
    availableMinutes: 30,
    sleepHours: 7,
    sleepQuality: 4
  };
}

function getCookie(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) throw new Error("Expected a session cookie.");
  return raw.split(";")[0];
}
