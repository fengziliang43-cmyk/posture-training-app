import type { Database } from "sqlite";

export async function runMigrations(db: Database): Promise<void> {
  await db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      low_back_pain INTEGER NOT NULL,
      neck_shoulder_pain INTEGER,
      energy INTEGER NOT NULL,
      available_minutes INTEGER NOT NULL,
      sleep_hours REAL,
      sleep_quality INTEGER,
      steps INTEGER,
      eating_status TEXT,
      weight_kg REAL,
      red_flags_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      time_version TEXT NOT NULL,
      template_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      exercises_json TEXT NOT NULL,
      safety_message TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workout_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completion_status TEXT NOT NULL,
      notes TEXT,
      low_back_pain_after INTEGER,
      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS posture_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      photo_date TEXT NOT NULL,
      angle TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
