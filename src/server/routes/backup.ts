import type { FastifyInstance } from "fastify";
import { constants } from "node:fs";
import { access, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { requireAuthenticatedUserId, type SessionStore } from "../auth";
import { openAppDatabase } from "../db";
import { createZip, type ZipEntry } from "../zip";

interface BackupRouteContext {
  sessions: SessionStore;
  databaseFile: string;
  uploadDir: string;
}

export function registerBackupRoutes(app: FastifyInstance, context: BackupRouteContext): void {
  app.get("/api/backup/export", async (request, reply) => {
    const userId = requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) return;

    const exportTime = new Date().toISOString();
    const entries: ZipEntry[] = [
      {
        path: "manifest.json",
        data: Buffer.from(
          JSON.stringify(
            {
              app: "posture-training-app",
              exportedAt: exportTime,
              includesDeepSeekApiKey: false
            },
            null,
            2
          )
        )
      }
    ];

    if (context.databaseFile !== ":memory:" && (await exists(context.databaseFile))) {
      const tempDir = await mkdtemp(join(tmpdir(), "posture-backup-"));
      const tempDb = join(tempDir, `sanitized-${basename(context.databaseFile)}`);
      try {
        await createSanitizedDatabaseCopy(context.databaseFile, tempDb);
        entries.push({ path: "data/app.sqlite", data: await readFile(tempDb) });
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    }

    if (await exists(context.uploadDir)) {
      entries.push(...(await collectUploadEntries(context.uploadDir)));
    }

    const zip = createZip(entries);
    reply
      .header("Content-Type", "application/zip")
      .header("Content-Disposition", `attachment; filename="posture-training-backup-${exportTime.slice(0, 10)}.zip"`);
    return zip;
  });
}

async function createSanitizedDatabaseCopy(sourceFile: string, targetFile: string): Promise<void> {
  const db = await openAppDatabase(targetFile);
  const source = sourceFile.replaceAll("'", "''");

  try {
    await db.exec(`
      ATTACH DATABASE '${source}' AS source;

      INSERT INTO users (id, username, password_hash, created_at)
      SELECT id, username, password_hash, created_at FROM source.users;

      INSERT INTO checkins (
        id,
        date,
        low_back_pain,
        neck_shoulder_pain,
        energy,
        available_minutes,
        sleep_hours,
        sleep_quality,
        steps,
        eating_status,
        weight_kg,
        red_flags_json,
        created_at
      )
      SELECT
        id,
        date,
        low_back_pain,
        neck_shoulder_pain,
        energy,
        available_minutes,
        sleep_hours,
        sleep_quality,
        steps,
        eating_status,
        weight_kg,
        red_flags_json,
        created_at
      FROM source.checkins;

      INSERT INTO plans (
        id,
        date,
        type,
        time_version,
        template_id,
        reason,
        exercises_json,
        safety_message,
        created_at
      )
      SELECT
        id,
        date,
        type,
        time_version,
        template_id,
        reason,
        exercises_json,
        safety_message,
        created_at
      FROM source.plans;

      INSERT INTO workout_logs (
        id,
        plan_id,
        completed_at,
        completion_status,
        notes,
        low_back_pain_after
      )
      SELECT
        id,
        plan_id,
        completed_at,
        completion_status,
        notes,
        low_back_pain_after
      FROM source.workout_logs;

      INSERT INTO posture_photos (
        id,
        photo_date,
        angle,
        file_path,
        mime_type,
        note,
        created_at
      )
      SELECT
        id,
        photo_date,
        angle,
        file_path,
        mime_type,
        note,
        created_at
      FROM source.posture_photos;

      INSERT INTO plan_exercise_replacements (
        id,
        plan_id,
        original_exercise_id,
        replacement_exercise_id,
        original_exercise_json,
        replaced_at,
        reverted_at
      )
      SELECT
        id,
        plan_id,
        original_exercise_id,
        replacement_exercise_id,
        original_exercise_json,
        replaced_at,
        reverted_at
      FROM source.plan_exercise_replacements;

      INSERT INTO settings (key, value_json, updated_at)
      SELECT key, value_json, updated_at
      FROM source.settings
      WHERE key != 'deepseekApiKey';

      DETACH DATABASE source;
      VACUUM;
    `);
  } finally {
    await db.close();
  }
}

async function collectUploadEntries(uploadDir: string): Promise<ZipEntry[]> {
  const root = resolve(uploadDir);
  const entries: ZipEntry[] = [];
  const names = await readdir(root);

  for (const name of names) {
    const filePath = resolve(root, name);
    if (!filePath.startsWith(root)) continue;
    const fileStat = await stat(filePath);
    if (fileStat.isFile()) {
      entries.push({
        path: `uploads/${relative(root, filePath)}`,
        data: await readFile(filePath)
      });
    }
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
