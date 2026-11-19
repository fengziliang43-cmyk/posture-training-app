import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatLocalDate } from "../../src/core/date";
import { buildApp } from "../../src/server/app";
import { SESSION_COOKIE_NAME } from "../../src/server/auth";

const multipartBoundary = "----zixu-read-token-boundary";

function shiftIsoDate(base: string, deltaDays: number): string {
  const parsed = new Date(`${base}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + deltaDays);
  return parsed.toISOString().slice(0, 10);
}

async function createTempApp() {
  const tempDir = await mkdtemp(join(tmpdir(), "zixu-read-tokens-"));
  const app = await buildApp({
    databaseFile: join(tempDir, "app.sqlite"),
    uploadDir: join(tempDir, "uploads")
  });
  return {
    app,
    async cleanup() {
      await app.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  };
}

async function registerUser(
  app: Awaited<ReturnType<typeof buildApp>>,
  username: string,
  password = "test-password-123"
): Promise<{ cookie: string; userId: number }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      username,
      password,
      adultConfirmed: true,
      termsAccepted: true
    }
  });
  expect(res.statusCode).toBe(200);
  const setCookie = res.headers["set-cookie"];
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!raw) throw new Error("Missing set-cookie header");
  const cookie = raw.split(";")[0];
  return { cookie, userId: res.json().user.id };
}

async function completeOnboarding(
  app: Awaited<ReturnType<typeof buildApp>>,
  cookie: string
): Promise<void> {
  const res = await app.inject({
    method: "PUT",
    url: "/api/profile",
    headers: { cookie },
    payload: {
      adultConfirmed: true,
      healthConsent: true,
      ageRange: "18-29",
      fitnessLevel: "regular",
      goals: ["safe-movement", "posture"],
      equipment: ["bodyweight", "floor", "wall", "walking-space"],
      weeklyTrainingDays: 3,
      defaultSessionMinutes: 30,
      canWalk20Minutes: true,
      canChairStand: true,
      canHoldSupport20Seconds: true,
      limitations: []
    }
  });
  expect(res.statusCode).toBe(200);
}

function createMultipartPhotoPayload(date: string): Buffer {
  return Buffer.from(
    [
      `--${multipartBoundary}`,
      'Content-Disposition: form-data; name="photoDate"',
      "",
      date,
      `--${multipartBoundary}`,
      'Content-Disposition: form-data; name="angle"',
      "",
      "front",
      `--${multipartBoundary}`,
      'Content-Disposition: form-data; name="file"; filename="secret-photo.jpg"',
      "Content-Type: image/jpeg",
      "",
      "fake-image-bytes",
      `--${multipartBoundary}--`,
      ""
    ].join("\r\n")
  );
}

describe("read tokens and summary export", () => {
  it("creates, lists without secrets, exports allowlisted summary, and strips private fields", async () => {
    const { app, cleanup } = await createTempApp();
    try {
      const { cookie } = await registerUser(app, "alice-export");
      await completeOnboarding(app, cookie);

      const today = formatLocalDate();
      const yesterday = shiftIsoDate(today, -1);

      // Synthetic check-ins, workout with sensitive notes, and posture photo
      const checkinYesterday = await app.inject({
        method: "POST",
        url: "/api/checkins",
        headers: { cookie },
        payload: {
          date: yesterday,
          lowBackPain: 3,
          energy: 4,
          availableMinutes: 30,
          sleepHours: 7.5,
          steps: 8888,
          weightKg: 66.6,
          eatingStatus: "normal"
        }
      });
      expect(checkinYesterday.statusCode).toBe(200);

      const planRes = await app.inject({
        method: "POST",
        url: "/api/plans/today",
        headers: { cookie },
        payload: { date: yesterday }
      });
      expect(planRes.statusCode).toBe(200);
      const planId = planRes.json().plan.id;

      const workoutRes = await app.inject({
        method: "POST",
        url: `/api/workouts/${planId}/complete`,
        headers: { cookie },
        payload: {
          completionStatus: "completed",
          notes: "PRIVATE_WORKOUT_NOTE_SHOULD_NOT_EXPORT",
          lowBackPainAfter: 2
        }
      });
      expect(workoutRes.statusCode).toBe(200);

      const checkinToday = await app.inject({
        method: "POST",
        url: "/api/checkins",
        headers: { cookie },
        payload: {
          date: today,
          lowBackPain: 2,
          neckShoulderPain: 1,
          energy: 5,
          availableMinutes: 45,
          weightKg: 67.2,
          redFlags: { radiatingPain: true }
        }
      });
      expect(checkinToday.statusCode).toBe(200);

      const uploadPhoto = await app.inject({
        method: "POST",
        url: "/api/photos",
        headers: {
          cookie,
          "content-type": `multipart/form-data; boundary=${multipartBoundary}`
        },
        payload: createMultipartPhotoPayload(today)
      });
      expect(uploadPhoto.statusCode).toBe(200);
      const photo = uploadPhoto.json().photo;
      await app.inject({
        method: "PUT",
        url: `/api/photos/${photo.id}/note`,
        headers: { cookie },
        payload: { note: "PRIVATE_PHOTO_NOTE_SHOULD_NOT_EXPORT" }
      });

      const createDefault = await app.inject({
        method: "POST",
        url: "/api/read-tokens",
        headers: { cookie },
        payload: {}
      });
      expect(createDefault.statusCode).toBe(201);
      const created = createDefault.json();
      expect(created.token).toMatch(/^zx_/);
      expect(created.name).toBe("中控台");

      const listRes = await app.inject({
        method: "GET",
        url: "/api/read-tokens",
        headers: { cookie }
      });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json().tokens).toHaveLength(1);
      expect(Object.keys(listRes.json().tokens[0]).sort()).toEqual([
        "createdAt",
        "id",
        "lastUsedAt",
        "name"
      ]);
      expect(JSON.stringify(listRes.json())).not.toContain(created.token);

      const badName = await app.inject({
        method: "POST",
        url: "/api/read-tokens",
        headers: { cookie },
        payload: { name: "   ", extra: true }
      });
      expect(badName.statusCode).toBe(400);

      const exportRes = await app.inject({
        method: "GET",
        url: "/api/export/summary",
        headers: { authorization: `Bearer ${created.token}` }
      });
      expect(exportRes.statusCode).toBe(200);
      const bodyText = exportRes.body;
      const body = exportRes.json();

      expect(Object.keys(body).sort()).toEqual([
        "days",
        "generatedAt",
        "lastAdjustment",
        "month",
        "today",
        "version",
        "week"
      ]);
      expect(body.version).toBe(1);
      expect(body.today).toBe(today);
      expect(Object.keys(body.week).sort()).toEqual([
        "end",
        "recommendation",
        "start",
        "trainedDates"
      ]);
      expect(Object.keys(body.month).sort()).toEqual(["month", "trainedDates"]);
      expect(body.month.month).toBe(today.slice(0, 7));
      expect(body.month.trainedDates).toContain(yesterday);
      expect(body.days.length).toBeLessThanOrEqual(14);
      expect(body.days).toHaveLength(2);
      expect(body.days.map((d: { date: string }) => d.date)).toEqual([yesterday, today]);
      for (const day of body.days) {
        expect(Object.keys(day).sort()).toEqual([
          "date",
          "energy",
          "lowBackPain",
          "neckShoulderPain",
          "redFlag"
        ]);
      }
      expect(body.days[0].neckShoulderPain).toBeNull();
      expect(body.days[0].redFlag).toBe(false);
      expect(body.days[1].neckShoulderPain).toBe(1);
      expect(body.days[1].redFlag).toBe(true);
      expect(Object.keys(body.lastAdjustment).sort()).toEqual(["date", "reason"]);
      expect(body.lastAdjustment.date).toBe(yesterday);

      // No sensitive or extra fields leak
      expect(bodyText).not.toContain("PRIVATE_WORKOUT_NOTE_SHOULD_NOT_EXPORT");
      expect(bodyText).not.toContain("PRIVATE_PHOTO_NOTE_SHOULD_NOT_EXPORT");
      expect(bodyText).not.toContain("alice-export");
      expect(bodyText).not.toContain("weightKg");
      expect(bodyText).not.toContain("sleepHours");
      expect(bodyText).not.toContain("steps");
      expect(bodyText).not.toContain("radiatingPain");
      expect(bodyText).not.toContain(photo.filePath);
      expect(bodyText).not.toContain(created.token);

      // Touch updated lastUsedAt
      const listedAfter = await app.inject({
        method: "GET",
        url: "/api/read-tokens",
        headers: { cookie }
      });
      expect(listedAfter.json().tokens[0].lastUsedAt).toBeTruthy();

      // Backup does not include read_tokens
      const backupRes = await app.inject({
        method: "GET",
        url: "/api/backup/export",
        headers: { cookie }
      });
      expect(backupRes.statusCode).toBe(200);
      expect(backupRes.body).not.toContain("read_tokens");
      expect(backupRes.body).not.toContain("readTokens");
      expect(backupRes.body).not.toContain(created.token);
    } finally {
      await cleanup();
    }
  });

  it("enforces revocation, invalid tokens, cross-account isolation, cookie rejection, 60/hour limit, 5-token cap, and account deletion cascade", async () => {
    const { app, cleanup } = await createTempApp();
    try {
      const userA = await registerUser(app, "user-a-tokens");
      const userB = await registerUser(app, "user-b-tokens");
      await completeOnboarding(app, userA.cookie);
      await completeOnboarding(app, userB.cookie);

      const today = formatLocalDate();
      const checkinA = await app.inject({
        method: "POST",
        url: "/api/checkins",
        headers: { cookie: userA.cookie },
        payload: { date: today, lowBackPain: 1, energy: 5, availableMinutes: 30 }
      });
      expect(checkinA.statusCode).toBe(200);
      const checkinB = await app.inject({
        method: "POST",
        url: "/api/checkins",
        headers: { cookie: userB.cookie },
        payload: { date: today, lowBackPain: 9, energy: 1, availableMinutes: 15 }
      });
      expect(checkinB.statusCode).toBe(200);

      const createdRes = await app.inject({
        method: "POST",
        url: "/api/read-tokens",
        headers: { cookie: userA.cookie },
        payload: { name: "Mac 中控台" }
      });
      expect(createdRes.statusCode).toBe(201);
      const tokenA = createdRes.json();

      // Isolation: tokenA reads only A's checkin
      const exportA = await app.inject({
        method: "GET",
        url: "/api/export/summary",
        headers: { authorization: `Bearer ${tokenA.token}` }
      });
      expect(exportA.statusCode).toBe(200);
      expect(exportA.json().days).toHaveLength(1);
      expect(exportA.json().days[0].lowBackPain).toBe(1);

      // Using read token as session cookie or Bearer on normal endpoints fails
      const profileViaCookie = await app.inject({
        method: "GET",
        url: "/api/profile",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${tokenA.token}` }
      });
      expect(profileViaCookie.statusCode).toBe(401);

      const profileViaBearer = await app.inject({
        method: "GET",
        url: "/api/profile",
        headers: { authorization: `Bearer ${tokenA.token}` }
      });
      expect(profileViaBearer.statusCode).toBe(401);

      // Cookie alone or bad token fails on /api/export/summary
      expect((await app.inject({ method: "GET", url: "/api/export/summary" })).statusCode).toBe(401);
      expect(
        (
          await app.inject({
            method: "GET",
            url: "/api/export/summary",
            headers: { cookie: userA.cookie }
          })
        ).statusCode
      ).toBe(401);
      expect(
        (
          await app.inject({
            method: "GET",
            url: "/api/export/summary",
            headers: { authorization: "Bearer zx_nonexistent_token" }
          })
        ).statusCode
      ).toBe(401);

      // Rate limit: 1 already used, 59 more succeed, 61st returns 429
      for (let i = 2; i <= 60; i++) {
        const res = await app.inject({
          method: "GET",
          url: "/api/export/summary",
          headers: { authorization: `Bearer ${tokenA.token}` }
        });
        expect(res.statusCode).toBe(200);
      }
      const rateLimited = await app.inject({
        method: "GET",
        url: "/api/export/summary",
        headers: { authorization: `Bearer ${tokenA.token}` }
      });
      expect(rateLimited.statusCode).toBe(429);

      // Other user cannot revoke A's token
      const crossRevoke = await app.inject({
        method: "DELETE",
        url: `/api/read-tokens/${tokenA.id}`,
        headers: { cookie: userB.cookie }
      });
      expect(crossRevoke.statusCode).toBe(404);

      // Owner revokes -> subsequent calls get 401
      const revokeRes = await app.inject({
        method: "DELETE",
        url: `/api/read-tokens/${tokenA.id}`,
        headers: { cookie: userA.cookie }
      });
      expect(revokeRes.statusCode).toBe(200);
      const afterRevoke = await app.inject({
        method: "GET",
        url: "/api/export/summary",
        headers: { authorization: `Bearer ${tokenA.token}` }
      });
      expect(afterRevoke.statusCode).toBe(401);

      // Cap at 5 active tokens even under concurrent requests
      const burst = await Promise.all(
        Array.from({ length: 8 }, (_, idx) =>
          app.inject({
            method: "POST",
            url: "/api/read-tokens",
            headers: { cookie: userA.cookie },
            payload: { name: `Key ${idx + 1}` }
          })
        )
      );
      const createdCount = burst.filter((res) => res.statusCode === 201).length;
      const conflictCount = burst.filter((res) => res.statusCode === 409).length;
      expect(createdCount).toBe(5);
      expect(conflictCount).toBe(3);

      // Deleting account cascades to read_tokens
      const delAccount = await app.inject({
        method: "DELETE",
        url: "/api/account",
        headers: { cookie: userA.cookie },
        payload: { password: "test-password-123", confirmation: "user-a-tokens" }
      });
      expect(delAccount.statusCode).toBe(200);

      const remaining = await (app as any).db.all(
        "SELECT id FROM read_tokens WHERE user_id = ?",
        userA.userId
      );
      expect(remaining).toEqual([]);
    } finally {
      await cleanup();
    }
  });
});
