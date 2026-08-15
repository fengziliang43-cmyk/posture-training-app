import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import type { Dirent } from "node:fs";
import { access, mkdir, readdir, rename, rm } from "node:fs/promises";
import { basename, dirname, resolve, sep } from "node:path";
import { z } from "zod";
import {
  clearSessionCookie,
  hashPassword,
  requireAuthenticatedUserId,
  type SessionStore,
  verifyPassword
} from "../auth";
import type { AppDatabase } from "../db";
import { FixedWindowRateLimiter } from "./auth";

const deleteAccountSchema = z.object({
  password: z.string().min(6).max(128),
  confirmation: z.string().min(1).max(254)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6).max(128),
  newPassword: z.string().min(10).max(128)
});

interface AccountRouteContext {
  db: AppDatabase;
  sessions: SessionStore;
  uploadDir: string;
  secureCookies: boolean;
}

export function registerAccountRoutes(app: FastifyInstance, context: AccountRouteContext): void {
  const passwordChangeLimiter = new FixedWindowRateLimiter(5, 15 * 60_000);

  app.put("/api/account/password", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) return;
    const parsed = changePasswordSchema.safeParse(request.body ?? {});
    if (!parsed.success || parsed.data.currentPassword === parsed.data.newPassword) {
      return reply.code(400).send({ error: "invalid new password" });
    }
    if (!passwordChangeLimiter.consume(`${request.ip}:${userId}`)) {
      return reply.code(429).send({ error: "too many attempts" });
    }

    const user = await context.db.get<{ password_hash: string; status: string }>(
      "SELECT password_hash, status FROM users WHERE id = ?",
      userId
    );
    const passwordMatches = user
      ? await verifyPassword(parsed.data.currentPassword, user.password_hash)
      : false;
    if (!user || user.status !== "active" || !passwordMatches) {
      return reply.code(403).send({ error: "current password incorrect" });
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await context.db.exec("BEGIN IMMEDIATE");
    try {
      await context.db.run(
        "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        passwordHash,
        userId
      );
      await context.sessions.deleteForUser(userId);
      await context.db.exec("COMMIT");
    } catch (error) {
      await context.db.exec("ROLLBACK");
      throw error;
    }

    clearSessionCookie(reply, context.secureCookies);
    return { ok: true, reauthenticationRequired: true };
  });

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
      await mkdir(quarantineDir, { recursive: true });
      for (const photo of photos) {
        const source = resolve(uploadRoot, photo.file_path);
        if (!source.startsWith(`${uploadRoot}${sep}`) || !await pathExists(source)) continue;
        const target = resolve(quarantineDir, `${photo.id}-${basename(source)}`);
        await rename(source, target);
        movedFiles.push({ from: source, to: target });
      }
      await context.db.run("DELETE FROM users WHERE id = ?", userId);
      await context.db.exec("COMMIT");
    } catch (error) {
      const rollbackErrors: unknown[] = [];
      await context.db.exec("ROLLBACK").catch((rollbackError) => rollbackErrors.push(rollbackError));
      for (const moved of movedFiles.reverse()) {
        try {
          await mkdir(dirname(moved.from), { recursive: true });
          await rename(moved.to, moved.from);
        } catch (restoreError) {
          rollbackErrors.push(restoreError);
        }
      }
      if (rollbackErrors.length === 0) {
        await rm(quarantineDir, { recursive: true, force: true }).catch(() => undefined);
      }
      if (rollbackErrors.length > 0) {
        throw new AggregateError([error, ...rollbackErrors], "Account deletion rollback failed.");
      }
      throw error;
    }

    clearSessionCookie(reply, context.secureCookies);
    try {
      await removeDeletedAccountFiles(uploadRoot, userId, quarantineDir);
    } catch (error) {
      console.error("Account deletion file cleanup deferred.", {
        userId,
        reason: error instanceof Error ? error.message : "unknown error"
      });
      return reply.code(202).send({ ok: true, cleanupPending: true });
    }
    return { ok: true };
  });
}

export async function retryPendingAccountDeletionCleanup(
  db: AppDatabase,
  uploadDir: string
): Promise<void> {
  const uploadRoot = resolve(uploadDir);
  const quarantineRoot = resolve(uploadRoot, ".account-deletion");
  let entries: Dirent[];
  try {
    entries = await readdir(quarantineRoot, { withFileTypes: true });
  } catch (error) {
    if (isMissingPathError(error)) return;
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = /^(\d+)-[0-9a-f-]{36}$/i.exec(entry.name);
    if (!match) continue;
    const userId = Number(match[1]);
    if (!Number.isSafeInteger(userId) || userId <= 0) continue;
    const user = await db.get<{ id: number }>("SELECT id FROM users WHERE id = ?", userId);
    const quarantineDir = resolve(quarantineRoot, entry.name);
    if (user) {
      await restoreRolledBackAccountFiles(db, uploadRoot, userId, quarantineDir);
      continue;
    }
    await removeDeletedAccountFiles(uploadRoot, userId, quarantineDir);
  }
}

async function restoreRolledBackAccountFiles(
  db: AppDatabase,
  uploadRoot: string,
  userId: number,
  quarantineDir: string
): Promise<void> {
  const entries = await readdir(quarantineDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) {
      throw new Error("Unexpected account deletion quarantine entry.");
    }
    const match = /^(\d+)-/.exec(entry.name);
    if (!match) {
      throw new Error("Invalid account deletion quarantine file.");
    }
    const photoId = Number(match[1]);
    const photo = await db.get<{ file_path: string }>(
      "SELECT file_path FROM posture_photos WHERE id = ? AND user_id = ?",
      photoId,
      userId
    );
    if (!photo) {
      throw new Error("Account deletion quarantine file has no matching photo.");
    }
    const target = resolve(uploadRoot, photo.file_path);
    if (!target.startsWith(`${uploadRoot}${sep}`) || await pathExists(target)) {
      throw new Error("Account deletion quarantine restore target is unsafe.");
    }
    await mkdir(dirname(target), { recursive: true });
    await rename(resolve(quarantineDir, entry.name), target);
  }
  await rm(quarantineDir, { recursive: true });
}

async function removeDeletedAccountFiles(
  uploadRoot: string,
  userId: number,
  quarantineDir: string
): Promise<void> {
  await rm(resolve(uploadRoot, String(userId)), { recursive: true, force: true });
  await rm(quarantineDir, { recursive: true, force: true });
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
