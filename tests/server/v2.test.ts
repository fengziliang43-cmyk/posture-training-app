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
    const apiKey = "sk-fake-secret-for-test";
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

    const settings = await app.inject({ method: "GET", url: "/api/settings", headers: { cookie } });
    expect(settings.statusCode).toBe(200);
    expect(JSON.stringify(settings.json())).not.toContain(apiKey);

    const backup = await app.inject({ method: "GET", url: "/api/backup/export", headers: { cookie } });
    expect(backup.statusCode).toBe(200);
    expect(backup.body).not.toContain(apiKey);

    await app.close();
    await rm(tempDir, { recursive: true, force: true });
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
      payload: { apiKey: "sk-fake-secret-for-test" }
    });

    const test = await app.inject({
      method: "POST",
      url: "/api/ai/deepseek/test",
      headers: { cookie },
      payload: {}
    });

    expect(test.statusCode).toBe(200);
    expect(test.json().ok).toBe(true);
    expect(test.body).not.toContain("sk-fake-secret-for-test");

    await app.close();
  });
});

describe("v2 plan and photo features", () => {
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
    payload: { username: "liang", password: "test-password-123" }
  });

  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: "liang", password: "test-password-123" }
  });

  const setCookie = login.headers["set-cookie"];
  const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!rawCookie) throw new Error("Login did not set a cookie.");
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
