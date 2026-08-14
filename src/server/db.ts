import sqlite3 from "sqlite3";
import { open, type Database } from "sqlite";
import { mkdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { needsMultiUserMigration, runMigrations } from "./migrations";

export type AppDatabase = Database;

export async function openAppDatabase(databaseFile: string): Promise<AppDatabase> {
  const db = await open({
    filename: databaseFile,
    driver: sqlite3.Database
  });

  try {
    if (databaseFile !== ":memory:" && await needsMultiUserMigration(db)) {
      await createPreMigrationBackup(db, databaseFile);
    }
    await runMigrations(db);
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

async function createPreMigrationBackup(db: AppDatabase, databaseFile: string): Promise<void> {
  const source = resolve(databaseFile);
  const backupDir = join(dirname(source), "backups");
  await mkdir(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = join(backupDir, `${basename(source)}.before-multi-user-${timestamp}.sqlite`);
  const escapedTarget = target.replaceAll("'", "''");
  await db.exec(`VACUUM INTO '${escapedTarget}'`);
}
