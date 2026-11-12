import { describe, expect, it } from "vitest";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "../../src/server/app";
import { HEALTH_CONSENT_VERSION } from "../../src/server/routes/profile";

describe("open registration and onboarding", () => {
  it("advertises registration availability in development", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const response = await app.inject({ method: "GET", url: "/api/auth/capabilities" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ registrationEnabled: true, captchaEnabled: false });
    await app.close();
  });

  it("accepts a six-character registration password and rejects five characters", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const rejected = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        username: "short-password",
        password: "12345",
        adultConfirmed: true,
        termsAccepted: true
      }
    });
    expect(rejected.statusCode).toBe(400);

    const accepted = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        username: "six-password",
        password: "123456",
        adultConfirmed: true,
        termsAccepted: true
      }
    });
    expect(accepted.statusCode).toBe(200);
    await app.close();
  });

  it("limits registration attempts by client IP even when usernames rotate", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    for (let index = 0; index < 5; index += 1) {
      const username = `occupied-${index}`;
      await (app as any).db.run(
        `INSERT INTO users (username, username_normalized, password_hash)
         VALUES (?, ?, 'unused-test-hash')`,
        username,
        username
      );
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          username,
          password: "strong-password-123",
          adultConfirmed: true,
          termsAccepted: true
        }
      });
      expect(response.statusCode).toBe(409);
    }

    const blocked = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        username: "sixth-username",
        password: "strong-password-123",
        adultConfirmed: true,
        termsAccepted: true
      }
    });
    expect(blocked.statusCode).toBe(429);
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
    expect(registration.json().user.role).toBe("user");
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
    expect(me.json().user.role).toBe("user");

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
    expect(duplicate.json()).toEqual({ error: "account already exists" });

    const row = await (app as any).db.get(
      "SELECT password_hash FROM users WHERE username_normalized = ?",
      "new-user"
    );
    expect(row.password_hash).not.toContain("strong-password-123");
    await app.close();
  });

  it("updates an existing profile and applies changed equipment to the next plan", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const user = await registerAndOnboard(app, "profile-editor");
    const equipment = ["bodyweight", "floor", "wall", "walking-space", "resistance-band"];

    const updated = await app.inject({
      method: "PUT",
      url: "/api/profile",
      headers: { cookie: user.cookie },
      payload: { ...profilePayload(), equipment }
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().profile.equipment).toEqual(equipment);

    await app.inject({
      method: "POST",
      url: "/api/checkins",
      headers: { cookie: user.cookie },
      payload: { ...checkinPayload("2026-08-10"), availableMinutes: 45 }
    });
    const plan = await app.inject({
      method: "POST",
      url: "/api/plans/today",
      headers: { cookie: user.cookie },
      payload: { date: "2026-08-10" }
    });

    expect(plan.statusCode).toBe(200);
    expect(plan.json().plan.exercises.some((exercise: { exerciseId: string }) =>
      exercise.exerciseId.startsWith("band-")
    )).toBe(true);

    const persisted = await app.inject({
      method: "GET",
      url: "/api/profile",
      headers: { cookie: user.cookie }
    });
    expect(persisted.json().profile.equipment).toEqual(equipment);
    await app.close();
  });

  it("accepts QQ and Gmail addresses as case-insensitive login identifiers", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const qqRegistration = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        username: "Member.Name@qq.com",
        password: "strong-password-123",
        adultConfirmed: true,
        termsAccepted: true
      }
    });
    expect(qqRegistration.statusCode).toBe(200);
    expect(qqRegistration.json().user).toMatchObject({
      username: "Member.Name@qq.com",
      role: "user"
    });

    const qqLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "member.name@QQ.COM", password: "strong-password-123" }
    });
    expect(qqLogin.statusCode).toBe(200);
    expect(qqLogin.json().user.username).toBe("Member.Name@qq.com");

    const duplicateQqEmail = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        username: "member.name@QQ.COM",
        password: "different-password-123",
        adultConfirmed: true,
        termsAccepted: true
      }
    });
    expect(duplicateQqEmail.statusCode).toBe(409);
    expect(duplicateQqEmail.json()).toEqual({ error: "account already exists" });

    const gmailRegistration = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        username: "member@gmail.com",
        password: "another-password-123",
        adultConfirmed: true,
        termsAccepted: true
      }
    });
    expect(gmailRegistration.statusCode).toBe(200);

    const invalidEmail = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        username: "member@",
        password: "another-password-123",
        adultConfirmed: true,
        termsAccepted: true
      }
    });
    expect(invalidEmail.statusCode).toBe(400);

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

  it("retries committed account file cleanup on the next server start", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "zixu-delete-retry-"));
    const databaseFile = join(tempDir, "app.sqlite");
    const uploadDir = join(tempDir, "uploads");
    const firstApp = await buildApp({ databaseFile, uploadDir });
    const user = await registerAndOnboard(firstApp, "cleanup-retry");
    const userDir = join(uploadDir, String(user.id));
    const quarantineDir = join(
      uploadDir,
      ".account-deletion",
      `${user.id}-00000000-0000-4000-8000-000000000000`
    );
    await mkdir(userDir, { recursive: true });
    await mkdir(quarantineDir, { recursive: true });
    await writeFile(join(userDir, "orphan.jpg"), "orphan");
    await writeFile(join(quarantineDir, "quarantined.jpg"), "quarantined");
    await (firstApp as any).db.run("DELETE FROM users WHERE id = ?", user.id);
    await firstApp.close();

    const secondApp = await buildApp({ databaseFile, uploadDir });
    await expect(access(userDir)).rejects.toThrow();
    await expect(access(quarantineDir)).rejects.toThrow();
    await secondApp.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("restores quarantined photos when account deletion rolled back before commit", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "zixu-delete-rollback-retry-"));
    const databaseFile = join(tempDir, "app.sqlite");
    const uploadDir = join(tempDir, "uploads");
    const firstApp = await buildApp({ databaseFile, uploadDir });
    const user = await registerAndOnboard(firstApp, "cleanup-rollback-retry");
    const relativePath = `${user.id}/photo.jpg`;
    const userDir = join(uploadDir, String(user.id));
    const quarantineDir = join(
      uploadDir,
      ".account-deletion",
      `${user.id}-00000000-0000-4000-8000-000000000000`
    );
    await (firstApp as any).db.run(
      `INSERT INTO posture_photos (user_id, photo_date, angle, file_path, mime_type)
       VALUES (?, '2026-08-14', 'front', ?, 'image/jpeg')`,
      user.id,
      relativePath
    );
    const photo = await (firstApp as any).db.get(
      "SELECT id FROM posture_photos WHERE user_id = ?",
      user.id
    ) as { id: number };
    await mkdir(quarantineDir, { recursive: true });
    await writeFile(join(quarantineDir, `${photo.id}-photo.jpg`), "quarantined");
    await firstApp.close();

    const secondApp = await buildApp({ databaseFile, uploadDir });
    await expect(access(join(userDir, "photo.jpg"))).resolves.toBeUndefined();
    await expect(access(quarantineDir)).rejects.toThrow();
    await secondApp.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("records the health consent once, at first onboarding, under the notice version that was shown", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const user = await registerAndOnboard(app, "consent-check");
    const healthConsents = async () =>
      ((await (app as any).db.all(
        "SELECT policy_version FROM user_consents WHERE user_id = ? AND consent_type = 'health-data'",
        user.id
      )) as Array<{ policy_version: string }>).map((row) => row.policy_version);
    expect(await healthConsents()).toEqual([HEALTH_CONSENT_VERSION]);

    // Someone who agreed to an older notice edits the profile later: the edit form only says
    // "continue within what you agreed to", so no newer version may be recorded for them.
    await (app as any).db.run(
      "UPDATE user_consents SET policy_version = '2026-08-09-v1' WHERE user_id = ? AND consent_type = 'health-data'",
      user.id
    );
    const edit = await app.inject({
      method: "PUT",
      url: "/api/profile",
      headers: { cookie: user.cookie },
      payload: { ...profilePayload(), defaultSessionMinutes: 20 }
    });
    expect(edit.statusCode).toBe(200);
    expect(await healthConsents()).toEqual(["2026-08-09-v1"]);
    await app.close();
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
