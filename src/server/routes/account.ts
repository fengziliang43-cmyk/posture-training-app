import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { access, mkdir, rename, rm } from "node:fs/promises";
import { basename, dirname, resolve, sep } from "node:path";
import { z } from "zod";
import {
  clearSessionCookie,
  requireAuthenticatedUserId,
  type SessionStore,
  verifyPassword
} from "../auth";
import type { AppDatabase } from "../db";

const deleteAccountSchema = z.object({
  password: z.string().min(6).max(128),
  confirmation: z.string().min(1).max(32)
});

interface AccountRouteContext {
  db: AppDatabase;
  sessions: SessionStore;
  uploadDir: string;
  secureCookies: boolean;
}

export function registerAccountRoutes(app: FastifyInstance, context: AccountRouteContext): void {
  app.delete("/api/account", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) return;
    const parsed = deleteAccountSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "invalid confirmation" });

    const user = await context.db.get<{
      username: string;
      password_hash: string;
      status: string;
    }>("SELECT username, password_hash, status FROM users WHERE id = ?", userId);
    const passwordMatches = user
      ? await verifyPassword(parsed.data.password, user.password_hash)
      : false;
    if (!user || user.status !== "active" || !passwordMatches || parsed.data.confirmation !== user.username) {
      return reply.code(400).send({ error: "invalid confirmation" });
    }

    const photos = await context.db.all<Array<{ id: number; file_path: string }>>(
      "SELECT id, file_path FROM posture_photos WHERE user_id = ?",
      userId
    );
    const movedFiles: Array<{ from: string; to: string }> = [];
    const uploadRoot = resolve(context.uploadDir);
    const quarantineDir = resolve(
      uploadRoot,
      ".account-deletion",
      `${userId}-${randomUUID()}`
    );

    await context.db.exec("BEGIN IMMEDIATE");
    try {
      await context.db.run("UPDATE users SET status = 'deleting' WHERE id = ?", userId);
      for (const photo of photos) {
        const source = resolve(uploadRoot, photo.file_path);
        if (!source.startsWith(`${uploadRoot}${sep}`) || !await pathExists(source)) continue;
        await mkdir(quarantineDir, { recursive: true });
        const target = resolve(quarantineDir, `${photo.id}-${basename(source)}`);
        await rename(source, target);
        movedFiles.push({ from: source, to: target });
      }
      await context.db.run("DELETE FROM users WHERE id = ?", userId);
      await context.db.exec("COMMIT");
    } catch (error) {
      await context.db.exec("ROLLBACK");
      for (const moved of movedFiles.reverse()) {
        await mkdir(dirname(moved.from), { recursive: true }).catch(() => undefined);
        await rename(moved.to, moved.from).catch(() => undefined);
      }
      throw error;
    }

    await rm(resolve(uploadRoot, String(userId)), { recursive: true, force: true }).catch(() => undefined);
    await rm(quarantineDir, { recursive: true, force: true }).catch(() => undefined);
    clearSessionCookie(reply, context.secureCookies);
    return { ok: true };
  });
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
