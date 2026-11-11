import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/app";

describe("server app", () => {
  it("responds to health check", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    await app.close();
  });

  it("handles CORS preflight for APK requests", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/auth/login",
      headers: {
        origin: "https://localhost",
        "access-control-request-headers": "content-type, authorization",
        "access-control-request-method": "POST"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("https://localhost");
    expect(response.headers["access-control-allow-headers"]).toContain("Authorization");

    await app.close();
  });

  it("rejects CORS preflight from an unknown origin", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/auth/login",
      headers: { origin: "https://untrusted.example", "access-control-request-method": "POST" }
    });

    expect(response.statusCode).toBe(403);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();

    await app.close();
  });

  it("handles the authenticated training API flow", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const cookie = await createAuthenticatedCookie(app);

    const checkin = await app.inject({
      method: "POST",
      url: "/api/checkins",
      headers: { cookie },
      payload: {
        date: "2026-06-11",
        lowBackPain: 2,
        energy: 5,
        availableMinutes: 45,
        sleepHours: 7,
        sleepQuality: 4,
        eatingStatus: "normal"
      }
    });
    expect(checkin.statusCode).toBe(200);
    expect(checkin.json().checkin.date).toBe("2026-06-11");

    const recentCheckins = await app.inject({
      method: "GET",
      url: "/api/checkins/recent",
      headers: { cookie }
    });
    expect(recentCheckins.statusCode).toBe(200);
    expect(recentCheckins.json().checkins[0].date).toBe("2026-06-11");

    const plan = await app.inject({
      method: "POST",
      url: "/api/plans/today",
      headers: { cookie },
      payload: { date: "2026-06-11" }
    });
    expect(plan.statusCode).toBe(200);
    expect(plan.json().plan.exercises.length).toBeGreaterThan(0);

    const planId = plan.json().plan.id;
    const today = await app.inject({
      method: "GET",
      url: "/api/plans/today?date=2026-06-11",
      headers: { cookie }
    });
    expect(today.statusCode).toBe(200);
    expect(today.json().plan.id).toBe(planId);

    const workout = await app.inject({
      method: "POST",
      url: `/api/workouts/${planId}/complete`,
      headers: { cookie },
      payload: { completionStatus: "completed", notes: "状态稳定", lowBackPainAfter: 2 }
    });
    expect(workout.statusCode).toBe(200);

    const repeatedWorkout = await app.inject({
      method: "POST",
      url: `/api/workouts/${planId}/complete`,
      headers: { cookie },
      payload: { completionStatus: "completed", notes: "再次确认", lowBackPainAfter: 2 }
    });
    expect(repeatedWorkout.statusCode).toBe(200);
    expect(repeatedWorkout.json().workoutLog.id).toBe(workout.json().workoutLog.id);

    const records = await app.inject({
      method: "GET",
      url: "/api/records/summary?date=2026-06-11",
      headers: { cookie }
    });
    expect(records.statusCode).toBe(200);
    expect(records.json().summary.checkins.length).toBeGreaterThan(0);
    expect(records.json().summary.calendarCheckins[0].date).toBe("2026-06-11");
    expect(records.json().summary.weeklyTrainingCount).toBe(1);

    const photo = await app.inject({
      method: "POST",
      url: "/api/photos",
      headers: {
        cookie,
        "content-type": `multipart/form-data; boundary=${multipartBoundary}`
      },
      payload: createMultipartPhotoPayload()
    });
    expect(photo.statusCode).toBe(200);
    expect(photo.json().photo.angle).toBe("front");

    const privatePhotoFile = await app.inject({
      method: "GET",
      url: `/api/photos/${photo.json().photo.id}/file`,
      headers: { cookie }
    });
    expect(privatePhotoFile.statusCode).toBe(200);
    expect(privatePhotoFile.headers["content-type"]).toContain("image/jpeg");

    const publicUploadPath = await app.inject({
      method: "GET",
      url: `/uploads/${photo.json().photo.filePath}`
    });
    expect(publicUploadPath.statusCode).toBe(404);

    const photos = await app.inject({ method: "GET", url: "/api/photos", headers: { cookie } });
    expect(photos.statusCode).toBe(200);
    expect(photos.json().photos.length).toBe(1);

    const deletePhotoRes = await app.inject({
      method: "DELETE",
      url: `/api/photos/${photo.json().photo.id}`,
      headers: { cookie }
    });
    expect(deletePhotoRes.statusCode).toBe(200);
    expect(deletePhotoRes.json()).toEqual({ ok: true });

    const photosAfterDelete = await app.inject({ method: "GET", url: "/api/photos", headers: { cookie } });
    expect(photosAfterDelete.json().photos.length).toBe(0);

    const settings = await app.inject({ method: "GET", url: "/api/settings", headers: { cookie } });
    expect(settings.statusCode).toBe(200);
    expect(settings.json().settings.deepseekEnabled).toBe(false);

    await app.close();
  });

  it("validates dates, settings keys, and workout plan ids", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const cookie = await createAuthenticatedCookie(app);

    const invalidDate = await app.inject({
      method: "POST",
      url: "/api/checkins",
      headers: { cookie },
      payload: {
        date: "2026-02-30",
        lowBackPain: 2,
        energy: 4,
        availableMinutes: 30
      }
    });
    expect(invalidDate.statusCode).toBe(400);

    const invalidSetting = await app.inject({
      method: "PUT",
      url: "/api/settings",
      headers: { cookie },
      payload: { unexpectedKey: true }
    });
    expect(invalidSetting.statusCode).toBe(400);

    const missingPlan = await app.inject({
      method: "POST",
      url: "/api/workouts/999/complete",
      headers: { cookie },
      payload: { completionStatus: "completed" }
    });
    expect(missingPlan.statusCode).toBe(404);

    await app.close();
  });

  it("limits posture photo uploads", async () => {
    const app = await buildApp({
      databaseFile: ":memory:",
      uploadDir: "uploads-test",
      photoMaxBytes: 5
    });
    const cookie = await createAuthenticatedCookie(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/photos",
      headers: {
        cookie,
        "content-type": `multipart/form-data; boundary=${multipartBoundary}`
      },
      payload: createMultipartPhotoPayload()
    });

    expect(response.statusCode).toBe(413);
    await app.close();
  });
});

const multipartBoundary = "----codex-test-boundary";

async function createAuthenticatedCookie(app: Awaited<ReturnType<typeof buildApp>>): Promise<string> {
  await app.inject({
    method: "POST",
    url: "/api/auth/setup",
    payload: { username: "api-user", password: "test-password-123" }
  });

  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: "api-user", password: "test-password-123" }
  });

  const setCookie = login.headers["set-cookie"];
  const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!rawCookie) {
    throw new Error("Login did not set a cookie.");
  }

  return rawCookie.split(";")[0];
}

function createMultipartPhotoPayload(): Buffer {
  return Buffer.from(
    [
      `--${multipartBoundary}`,
      'Content-Disposition: form-data; name="photoDate"',
      "",
      "2026-06-11",
      `--${multipartBoundary}`,
      'Content-Disposition: form-data; name="angle"',
      "",
      "front",
      `--${multipartBoundary}`,
      'Content-Disposition: form-data; name="file"; filename="front.jpg"',
      "Content-Type: image/jpeg",
      "",
      "fake-image",
      `--${multipartBoundary}--`,
      ""
    ].join("\r\n")
  );
}
