import type { FastifyInstance } from "fastify";
import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";
import { requireAuthenticatedUserId, type SessionStore } from "../auth";
import type { AppDatabase } from "../db";
import { createZip, type ZipEntry } from "../zip";

interface BackupRouteContext {
  sessions: SessionStore;
  uploadDir: string;
  db: AppDatabase;
}

export function registerBackupRoutes(app: FastifyInstance, context: BackupRouteContext): void {
  app.get("/api/backup/export", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) return;

    const db = context.db;
    const exportedAt = new Date().toISOString();
    const data = await collectUserData(db, userId);
    const entries: ZipEntry[] = [
      {
        path: "manifest.json",
        data: Buffer.from(
          JSON.stringify(
            {
              app: "zixu",
              exportFormat: "user-json-v1",
              exportedAt,
              includesDeepSeekApiKey: false,
              userScoped: true
            },
            null,
            2
          )
        )
      },
      {
        path: "data/user-data.json",
        data: Buffer.from(JSON.stringify(data, null, 2))
      }
    ];

    entries.push(...await collectUserPhotoEntries(context.uploadDir, data.posturePhotos));
    const zip = createZip(entries);
    reply
      .header("Content-Type", "application/zip")
      .header("Content-Disposition", `attachment; filename="zixu-user-backup-${exportedAt.slice(0, 10)}.zip"`);
    return zip;
  });
}

async function collectUserData(db: AppDatabase, userId: number) {
  const user = await db.get(
    `SELECT id, username, role, status, created_at, updated_at
       FROM users WHERE id = ?`,
    userId
  );
  const profile = await db.get("SELECT * FROM user_profiles WHERE user_id = ?", userId);
  const consents = await db.all("SELECT * FROM user_consents WHERE user_id = ?", userId);
  const checkins = await db.all("SELECT * FROM checkins WHERE user_id = ? ORDER BY date", userId);
  const plans = await db.all("SELECT * FROM plans WHERE user_id = ? ORDER BY date", userId);
  const workouts = await db.all("SELECT * FROM workout_logs WHERE user_id = ? ORDER BY id", userId);
  const exerciseLogs = await db.all(
    "SELECT * FROM workout_exercise_logs WHERE user_id = ? ORDER BY id",
    userId
  );
  const posturePhotos = await db.all<Array<{ id: number; file_path: string }>>(
    "SELECT * FROM posture_photos WHERE user_id = ? ORDER BY photo_date, id",
    userId
  );
  const replacements = await db.all(
    "SELECT * FROM plan_exercise_replacements WHERE user_id = ? ORDER BY id",
    userId
  );
  const settings = await db.all(
    "SELECT user_id, key, value_json, updated_at FROM settings WHERE user_id = ? AND key != 'deepseekApiKey'",
    userId
  );
  return { user, profile, consents, checkins, plans, workouts, exerciseLogs, posturePhotos, replacements, settings };
}

async function collectUserPhotoEntries(
  uploadDir: string,
  photos: Array<{ id: number; file_path: string }>
): Promise<ZipEntry[]> {
  const root = resolve(uploadDir);
  const entries: ZipEntry[] = [];

  for (const photo of photos) {
    const filePath = resolve(root, photo.file_path);
    if (!filePath.startsWith(`${root}${sep}`) || !await exists(filePath)) continue;
    entries.push({
      path: `uploads/${photo.id}-${basename(filePath)}`,
      data: await readFile(filePath)
    });
  }

  return entries;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
