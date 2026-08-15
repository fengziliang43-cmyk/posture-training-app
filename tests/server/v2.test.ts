import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/server/app";

const multipartBoundary = "----codex-v2-boundary";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("v2 settings and safety", () => {
  it("stores DeepSeek key without leaking it through settings or backup", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "posture-v2-test-"));
    const apiKey = "test-api-key-placeholder";
    const app = await buildApp({
      databaseFile: join(tempDir, "app.sqlite"),
      uploadDir: join(tempDir, "uploads")
    });
    const cookie = await createAuthenticatedCookie(app);

    const save = await app.inject({
      method: "PUT",
      url: "/api/settings/deepseek-key",
      headers: { cookie },
      payload: { apiKey, model: "deepseek-v4-flash" }
    });
    expect(save.statusCode).toBe(200);
    expect(JSON.stringify(save.json())).not.toContain(apiKey);
    expect(save.json().settings.deepseekApiKeyConfigured).toBe(true);

    const stored = await (app as any).db.get(
      "SELECT value_json FROM settings WHERE key = 'deepseekApiKey'"
    );
    expect(stored.value_json).not.toContain(apiKey);
    expect(JSON.parse(stored.value_json)).toMatch(/^enc:v1:/);

    const settings = await app.inject({ method: "GET", url: "/api/settings", headers: { cookie } });
    expect(settings.statusCode).toBe(200);
    expect(JSON.stringify(settings.json())).not.toContain(apiKey);

    const backup = await app.inject({ method: "GET", url: "/api/backup/export", headers: { cookie } });
    expect(backup.statusCode).toBe(200);
    expect(backup.body).not.toContain(apiKey);

    await app.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("keeps encrypted DeepSeek keys isolated between accounts", async () => {
    const seenAuthorization: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        seenAuthorization.push(new Headers(init?.headers).get("Authorization") ?? "");
        return new Response(JSON.stringify({ choices: [{ message: { content: "连接正常" } }] }));
      })
    );

    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const firstCookie = await registerCookie(app, "ai-user-a");
    const secondCookie = await registerCookie(app, "ai-user-b");
    const firstKey = "sk-test-user-a-placeholder";
    const secondKey = "sk-test-user-b-placeholder";

    for (const [cookie, apiKey] of [[firstCookie, firstKey], [secondCookie, secondKey]]) {
      const save = await app.inject({
        method: "PUT",
        url: "/api/settings/deepseek-key",
        headers: { cookie },
        payload: { apiKey }
      });
      expect(save.statusCode).toBe(200);
      const test = await app.inject({
        method: "POST",
        url: "/api/ai/deepseek/test",
        headers: { cookie },
        payload: {}
      });
      expect(test.statusCode).toBe(200);
    }

    expect(seenAuthorization).toEqual([`Bearer ${firstKey}`, `Bearer ${secondKey}`]);
    const storedRows = await (app as any).db.all(
      "SELECT value_json FROM settings WHERE key = 'deepseekApiKey' ORDER BY user_id"
    );
    expect(storedRows).toHaveLength(2);
    expect(JSON.stringify(storedRows)).not.toContain(firstKey);
    expect(JSON.stringify(storedRows)).not.toContain(secondKey);
    expect(storedRows.every((row: { value_json: string }) =>
      String(JSON.parse(row.value_json)).startsWith("enc:v1:")
    )).toBe(true);

    await app.close();
  });

  it("tests DeepSeek through the server using a sanitized response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "连接正常" } }] })))
    );

    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const cookie = await createAuthenticatedCookie(app);
    await app.inject({
      method: "PUT",
      url: "/api/settings/deepseek-key",
      headers: { cookie },
      payload: { apiKey: "test-api-key-placeholder" }
    });

    const test = await app.inject({
      method: "POST",
      url: "/api/ai/deepseek/test",
      headers: { cookie },
      payload: {}
    });

    expect(test.statusCode).toBe(200);
    expect(test.json().ok).toBe(true);
    expect(test.body).not.toContain("test-api-key-placeholder");

    await app.close();
  });

  it("reports whether an AI explanation came from DeepSeek or a local fallback", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const cookie = await createAuthenticatedCookie(app);
    await createCheckin(app, cookie);
    const planResponse = await app.inject({
      method: "POST",
      url: "/api/plans/today",
      headers: { cookie },
      payload: { date: "2026-06-14" }
    });
    const planId = planResponse.json().plan.id;

    const local = await app.inject({
      method: "POST",
      url: "/api/ai/daily-explanation",
      headers: { cookie },
      payload: { planId }
    });
    expect(local.json().source).toBe("local");
    expect(local.json().fallbackReason).toBe("disabled");
    expect(local.json().generatedAt).toBeTypeOf("string");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "今天按原计划保守完成，不适立即停止。" } }] })))
    );
    await app.inject({
      method: "PUT",
      url: "/api/settings/deepseek-key",
      headers: { cookie },
      payload: { apiKey: "test-api-key-placeholder" }
    });

    const deepseek = await app.inject({
      method: "POST",
      url: "/api/ai/daily-explanation",
      headers: { cookie },
      payload: { planId }
    });
    expect(deepseek.json().source).toBe("deepseek");
    expect(deepseek.json().explanation).toContain("不适立即停止");
    expect(deepseek.body).not.toContain("test-api-key-placeholder");

    await app.close();
  });
});

describe("v2 plan and photo features", () => {
  it("preserves completed history but overlays a later red flag as a blocked current plan", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const cookie = await createAuthenticatedCookie(app);
    await createCheckin(app, cookie);

    const firstPlanResponse = await app.inject({
      method: "POST",
      url: "/api/plans/today",
      headers: { cookie },
      payload: { date: "2026-06-14" }
    });
    const firstPlan = firstPlanResponse.json().plan;
    expect(firstPlan.type).not.toBe("recovery");

    const completed = await app.inject({
      method: "POST",
      url: `/api/workouts/${firstPlan.id}/complete`,
      headers: { cookie },
      payload: { completionStatus: "completed", lowBackPainAfter: 3 }
    });
    expect(completed.statusCode).toBe(200);

    await app.inject({
      method: "POST",
      url: "/api/checkins",
      headers: { cookie },
      payload: {
        date: "2026-06-14",
        lowBackPain: 4,
        energy: 3,
        availableMinutes: 30,
        redFlags: { legNumbness: true }
      }
    });

    const regenerated = await app.inject({
      method: "POST",
      url: "/api/plans/today",
      headers: { cookie },
      payload: { date: "2026-06-14" }
    });
    expect(regenerated.statusCode).toBe(200);
    expect(regenerated.json().plan.id).toBe(firstPlan.id);
    expect(regenerated.json().plan.type).toBe("recovery");
    expect(regenerated.json().plan.exercises).toEqual([]);
    expect(regenerated.json().plan.decision.readinessScore).toBe(0);

    const storedPlan = await (app as any).repositories.forUser(1).getPlanById(firstPlan.id);
    expect(storedPlan.type).toBe(firstPlan.type);
    expect(storedPlan.exercises.length).toBeGreaterThan(0);

    const replacement = await app.inject({
      method: "POST",
      url: `/api/plans/${firstPlan.id}/exercises/${firstPlan.exercises[0].exerciseId}/replace`,
      headers: { cookie },
      payload: {}
    });
    expect(replacement.statusCode).toBe(400);
    expect(replacement.json().error).toContain("cannot be edited");

    const records = await app.inject({
      method: "GET",
      url: "/api/records/summary?date=2026-06-14",
      headers: { cookie }
    });
    expect(records.json().summary.weeklyTrainingCount).toBe(1);

    await app.close();
  });

  it("replaces and reverts a plan exercise through local replacement ids only", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const cookie = await createAuthenticatedCookie(app);
    await createCheckin(app, cookie);
    const planResponse = await app.inject({
      method: "POST",
      url: "/api/plans/today",
      headers: { cookie },
      payload: { date: "2026-06-14" }
    });
    const plan = planResponse.json().plan;
    const originalExerciseId = plan.exercises[0].exerciseId;

    const replaced = await app.inject({
      method: "POST",
      url: `/api/plans/${plan.id}/exercises/${originalExerciseId}/replace`,
      headers: { cookie },
      payload: {}
    });
    expect(replaced.statusCode).toBe(200);
    expect(replaced.json().plan.exercises[0].exerciseId).not.toBe(originalExerciseId);
    expect(replaced.json().plan.exercises[0].replacedFromId).toBe(originalExerciseId);

    const replacementId = replaced.json().plan.exercises[0].exerciseId;
    const reverted = await app.inject({
      method: "POST",
      url: `/api/plans/${plan.id}/exercises/${replacementId}/revert`,
      headers: { cookie },
      payload: {}
    });
    expect(reverted.statusCode).toBe(200);
    expect(reverted.json().plan.exercises[0].exerciseId).toBe(originalExerciseId);

    await app.close();
  });

  it("stores posture photo notes", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const cookie = await createAuthenticatedCookie(app);

    const photo = await app.inject({
      method: "POST",
      url: "/api/photos",
      headers: {
        cookie,
        "content-type": `multipart/form-data; boundary=${multipartBoundary}`
      },
      payload: createMultipartPhotoPayload("自然站姿")
    });
    expect(photo.statusCode).toBe(200);
    expect(photo.json().photo.note).toBe("自然站姿");

    const note = await app.inject({
      method: "PUT",
      url: `/api/photos/${photo.json().photo.id}/note`,
      headers: { cookie },
      payload: { note: "训练后复拍" }
    });
    expect(note.statusCode).toBe(200);
    expect(note.json().photo.note).toBe("训练后复拍");

    await app.close();
  });
});

async function createAuthenticatedCookie(app: Awaited<ReturnType<typeof buildApp>>): Promise<string> {
  await app.inject({
    method: "POST",
    url: "/api/auth/setup",
    payload: { username: "v2-user", password: "test-password-123" }
  });

  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: "v2-user", password: "test-password-123" }
  });

  const setCookie = login.headers["set-cookie"];
  const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!rawCookie) throw new Error("Login did not set a cookie.");
  return rawCookie.split(";")[0];
}

async function registerCookie(
  app: Awaited<ReturnType<typeof buildApp>>,
  username: string
): Promise<string> {
  const registration = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      username,
      password: "123456",
      adultConfirmed: true,
      termsAccepted: true
    }
  });
  expect(registration.statusCode).toBe(200);
  const setCookie = registration.headers["set-cookie"];
  const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!rawCookie) throw new Error("Registration did not set a cookie.");
  return rawCookie.split(";")[0];
}

async function createCheckin(app: Awaited<ReturnType<typeof buildApp>>, cookie: string): Promise<void> {
  await app.inject({
    method: "POST",
    url: "/api/checkins",
    headers: { cookie },
    payload: {
      date: "2026-06-14",
      lowBackPain: 2,
      energy: 5,
      availableMinutes: 45,
      sleepHours: 7
    }
  });
}

function createMultipartPhotoPayload(note: string): Buffer {
  return Buffer.from(
    [
      `--${multipartBoundary}`,
      'Content-Disposition: form-data; name="photoDate"',
      "",
      "2026-06-14",
      `--${multipartBoundary}`,
      'Content-Disposition: form-data; name="angle"',
      "",
      "front",
      `--${multipartBoundary}`,
      'Content-Disposition: form-data; name="note"',
      "",
      note,
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
