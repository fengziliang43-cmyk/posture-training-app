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

    const records = await app.inject({
      method: "GET",
      url: "/api/records/summary?date=2026-06-11",
      headers: { cookie }
    });
    expect(records.statusCode).toBe(200);
    expect(records.json().summary.checkins.length).toBeGreaterThan(0);
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

    const photos = await app.inject({ method: "GET", url: "/api/photos", headers: { cookie } });
    expect(photos.statusCode).toBe(200);
    expect(photos.json().photos.length).toBe(1);

    const settings = await app.inject({ method: "GET", url: "/api/settings", headers: { cookie } });
    expect(settings.statusCode).toBe(200);
    expect(settings.json().settings.deepseekEnabled).toBe(false);

    await app.close();
  });
});

const multipartBoundary = "----codex-test-boundary";

async function createAuthenticatedCookie(app: Awaited<ReturnType<typeof buildApp>>): Promise<string> {
  await app.inject({
    method: "POST",
    url: "/api/auth/setup",
    payload: { username: "liang", password: "test-password-123" }
  });

  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: "liang", password: "test-password-123" }
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
