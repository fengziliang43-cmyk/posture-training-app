import type { Database } from "sqlite";

export const CURRENT_SCHEMA_VERSION = 2;

export async function runMigrations(db: Database): Promise<void> {
  await db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      username_normalized TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    );
  `);

  await addColumnIfMissing(db, "users", "username_normalized", "TEXT");
  await addColumnIfMissing(db, "users", "role", "TEXT NOT NULL DEFAULT 'user'");
  await addColumnIfMissing(db, "users", "status", "TEXT NOT NULL DEFAULT 'active'");
  await addColumnIfMissing(db, "users", "updated_at", "TEXT");
  await db.exec(`
    UPDATE users
      SET username_normalized = lower(trim(username))
      WHERE username_normalized IS NULL OR username_normalized = '';
    UPDATE users
      SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_normalized
      ON users(username_normalized);
  `);

  const migratingLegacyData = await isLegacyDataSchema(db);
  if (migratingLegacyData) {
    await ensureLegacyColumns(db);
    await migrateLegacyDataTables(db);
  }

  await createCurrentTables(db);
  if (migratingLegacyData) {
    await backfillLegacyProfiles(db);
  }
  await createCurrentIndexes(db);
  await db.run(
    "INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)",
    CURRENT_SCHEMA_VERSION
  );
}

export async function needsMultiUserMigration(db: Database): Promise<boolean> {
  return isLegacyDataSchema(db);
}

async function createCurrentTables(db: Database): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id INTEGER PRIMARY KEY,
      age_range TEXT NOT NULL,
      height_cm REAL,
      weight_kg REAL,
      fitness_level TEXT NOT NULL,
      goals_json TEXT NOT NULL,
      equipment_json TEXT NOT NULL,
      weekly_training_days INTEGER NOT NULL,
      default_session_minutes INTEGER NOT NULL,
      can_walk_20_minutes INTEGER NOT NULL,
      can_chair_stand INTEGER NOT NULL,
      can_hold_support_20_seconds INTEGER NOT NULL,
      limitations_json TEXT NOT NULL,
      baseline_low_back_pain INTEGER,
      baseline_neck_shoulder_pain INTEGER,
      onboarding_version TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_consents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      consent_type TEXT NOT NULL,
      policy_version TEXT NOT NULL,
      granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at TEXT,
      UNIQUE(user_id, consent_type, policy_version),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
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
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      time_version TEXT NOT NULL,
      template_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      exercises_json TEXT NOT NULL,
      safety_message TEXT,
      algorithm_version TEXT NOT NULL DEFAULT 'legacy-v1',
      estimated_minutes REAL NOT NULL DEFAULT 0,
      decision_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workout_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan_id INTEGER NOT NULL,
      completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completion_status TEXT NOT NULL,
      notes TEXT,
      low_back_pain_after INTEGER,
      UNIQUE(user_id, plan_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workout_exercise_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      workout_log_id INTEGER NOT NULL,
      plan_id INTEGER NOT NULL,
      exercise_id TEXT NOT NULL,
      exercise_index INTEGER NOT NULL,
      completion_status TEXT NOT NULL,
      feedback TEXT NOT NULL DEFAULT 'none',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, workout_log_id, exercise_index),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (workout_log_id) REFERENCES workout_logs(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS posture_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      photo_date TEXT NOT NULL,
      angle TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS plan_exercise_replacements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan_id INTEGER NOT NULL,
      original_exercise_id TEXT NOT NULL,
      replacement_exercise_id TEXT NOT NULL,
      original_exercise_json TEXT NOT NULL,
      replaced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reverted_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      user_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id, key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

async function createCurrentIndexes(db: Database): Promise<void> {
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_user_expires
      ON sessions(user_id, expires_at);
    CREATE INDEX IF NOT EXISTS idx_checkins_user_date
      ON checkins(user_id, date DESC);
    CREATE INDEX IF NOT EXISTS idx_plans_user_date
      ON plans(user_id, date DESC);
    CREATE INDEX IF NOT EXISTS idx_workout_logs_user_plan
      ON workout_logs(user_id, plan_id);
    CREATE INDEX IF NOT EXISTS idx_workout_exercise_logs_user_plan
      ON workout_exercise_logs(user_id, plan_id, exercise_index);
    CREATE INDEX IF NOT EXISTS idx_posture_photos_user_date
      ON posture_photos(user_id, photo_date DESC);
    CREATE INDEX IF NOT EXISTS idx_replacements_user_plan
      ON plan_exercise_replacements(user_id, plan_id, replaced_at DESC);
  `);
}

async function backfillLegacyProfiles(db: Database): Promise<void> {
  const users = await db.all<Array<{ id: number }>>("SELECT id FROM users ORDER BY id ASC");
  if (users.length === 0) return;
  await db.run("UPDATE users SET role = 'admin' WHERE id = ?", users[0].id);
  for (const user of users) {
    await db.run(
      `INSERT OR IGNORE INTO user_profiles (
        user_id, age_range, fitness_level, goals_json, equipment_json,
        weekly_training_days, default_session_minutes, can_walk_20_minutes,
        can_chair_stand, can_hold_support_20_seconds, limitations_json,
        onboarding_version, completed_at
      ) VALUES (?, '18-29', 'regular', ?, ?, 3, 45, 1, 1, 1, '[]', 'legacy-v1', CURRENT_TIMESTAMP)`,
      user.id,
      JSON.stringify(["safe-movement", "posture"]),
      JSON.stringify(["bodyweight", "floor", "pull-up-bar", "resistance-band", "wall", "step", "walking-space"])
    );
  }
}

async function ensureLegacyColumns(db: Database): Promise<void> {
  if (await tableExists(db, "posture_photos")) {
    await addColumnIfMissing(db, "posture_photos", "note", "TEXT");
  }
  if (await tableExists(db, "plans")) {
    await addColumnIfMissing(db, "plans", "algorithm_version", "TEXT NOT NULL DEFAULT 'legacy-v1'");
    await addColumnIfMissing(db, "plans", "estimated_minutes", "REAL NOT NULL DEFAULT 0");
    await addColumnIfMissing(db, "plans", "decision_json", "TEXT NOT NULL DEFAULT '{}'");
  }
}

async function migrateLegacyDataTables(db: Database): Promise<void> {
  const owner = await db.get<{ id: number }>("SELECT id FROM users ORDER BY id ASC LIMIT 1");
  const legacyRows = await countLegacyRows(db);
  if (!owner && legacyRows > 0) {
    throw new Error("Legacy training data exists without an owner account; migration stopped.");
  }
  const ownerId = owner?.id ?? 0;

  await db.exec("PRAGMA foreign_keys = OFF");
  await db.exec("BEGIN IMMEDIATE");
  try {
    await db.exec(`
      CREATE TABLE checkins_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
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
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE plans_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL,
        time_version TEXT NOT NULL,
        template_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        exercises_json TEXT NOT NULL,
        safety_message TEXT,
        algorithm_version TEXT NOT NULL DEFAULT 'legacy-v1',
        estimated_minutes REAL NOT NULL DEFAULT 0,
        decision_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE workout_logs_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        plan_id INTEGER NOT NULL,
        completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completion_status TEXT NOT NULL,
        notes TEXT,
        low_back_pain_after INTEGER,
        UNIQUE(user_id, plan_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (plan_id) REFERENCES plans_new(id) ON DELETE CASCADE
      );

      CREATE TABLE workout_exercise_logs_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        workout_log_id INTEGER NOT NULL,
        plan_id INTEGER NOT NULL,
        exercise_id TEXT NOT NULL,
        exercise_index INTEGER NOT NULL,
        completion_status TEXT NOT NULL,
        feedback TEXT NOT NULL DEFAULT 'none',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, workout_log_id, exercise_index),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (workout_log_id) REFERENCES workout_logs_new(id) ON DELETE CASCADE,
        FOREIGN KEY (plan_id) REFERENCES plans_new(id) ON DELETE CASCADE
      );

      CREATE TABLE posture_photos_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        photo_date TEXT NOT NULL,
        angle TEXT NOT NULL,
        file_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE plan_exercise_replacements_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        plan_id INTEGER NOT NULL,
        original_exercise_id TEXT NOT NULL,
        replacement_exercise_id TEXT NOT NULL,
        original_exercise_json TEXT NOT NULL,
        replaced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reverted_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (plan_id) REFERENCES plans_new(id) ON DELETE CASCADE
      );

      CREATE TABLE settings_new (
        user_id INTEGER NOT NULL,
        key TEXT NOT NULL,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(user_id, key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    if (owner && await tableExists(db, "checkins")) {
      await db.run(
        `INSERT INTO checkins_new
          SELECT id, ?, date, low_back_pain, neck_shoulder_pain, energy, available_minutes,
                 sleep_hours, sleep_quality, steps, eating_status, weight_kg, red_flags_json, created_at
          FROM checkins`,
        ownerId
      );
    }
    if (owner && await tableExists(db, "plans")) {
      await db.run(
        `INSERT INTO plans_new
          SELECT id, ?, date, type, time_version, template_id, reason, exercises_json,
                 safety_message, algorithm_version, estimated_minutes, decision_json, created_at
          FROM plans`,
        ownerId
      );
    }
    if (owner && await tableExists(db, "workout_logs")) {
      await db.run(
        `INSERT INTO workout_logs_new
          SELECT id, ?, plan_id, completed_at, completion_status, notes, low_back_pain_after
          FROM workout_logs`,
        ownerId
      );
    }
    if (owner && await tableExists(db, "workout_exercise_logs")) {
      await db.run(
        `INSERT INTO workout_exercise_logs_new
          SELECT id, ?, workout_log_id, plan_id, exercise_id, exercise_index,
                 completion_status, feedback, created_at
          FROM workout_exercise_logs`,
        ownerId
      );
    }
    if (owner && await tableExists(db, "posture_photos")) {
      await db.run(
        `INSERT INTO posture_photos_new
          SELECT id, ?, photo_date, angle, file_path, mime_type, note, created_at
          FROM posture_photos`,
        ownerId
      );
    }
    if (owner && await tableExists(db, "plan_exercise_replacements")) {
      await db.run(
        `INSERT INTO plan_exercise_replacements_new
          SELECT id, ?, plan_id, original_exercise_id, replacement_exercise_id,
                 original_exercise_json, replaced_at, reverted_at
          FROM plan_exercise_replacements`,
        ownerId
      );
    }
    if (owner && await tableExists(db, "settings")) {
      await db.run(
        `INSERT INTO settings_new
          SELECT ?, key, value_json, updated_at FROM settings`,
        ownerId
      );
    }

    await db.exec(`
      DROP TABLE IF EXISTS workout_exercise_logs;
      DROP TABLE IF EXISTS plan_exercise_replacements;
      DROP TABLE IF EXISTS workout_logs;
      DROP TABLE IF EXISTS posture_photos;
      DROP TABLE IF EXISTS settings;
      DROP TABLE IF EXISTS plans;
      DROP TABLE IF EXISTS checkins;

      ALTER TABLE checkins_new RENAME TO checkins;
      ALTER TABLE plans_new RENAME TO plans;
      ALTER TABLE workout_logs_new RENAME TO workout_logs;
      ALTER TABLE workout_exercise_logs_new RENAME TO workout_exercise_logs;
      ALTER TABLE posture_photos_new RENAME TO posture_photos;
      ALTER TABLE plan_exercise_replacements_new RENAME TO plan_exercise_replacements;
      ALTER TABLE settings_new RENAME TO settings;
    `);
    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  } finally {
    await db.exec("PRAGMA foreign_keys = ON");
  }
}

async function isLegacyDataSchema(db: Database): Promise<boolean> {
  const tables = [
    "checkins",
    "plans",
    "workout_logs",
    "workout_exercise_logs",
    "posture_photos",
    "plan_exercise_replacements",
    "settings"
  ];
  for (const table of tables) {
    if (await tableExists(db, table) && !(await hasColumn(db, table, "user_id"))) {
      return true;
    }
  }
  return false;
}

async function countLegacyRows(db: Database): Promise<number> {
  const tables = [
    "checkins",
    "plans",
    "workout_logs",
    "workout_exercise_logs",
    "posture_photos",
    "plan_exercise_replacements",
    "settings"
  ];
  let count = 0;
  for (const table of tables) {
    if (!await tableExists(db, table)) continue;
    const row = await db.get<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`);
    count += row?.count ?? 0;
  }
  return count;
}

async function tableExists(db: Database, table: string): Promise<boolean> {
  const row = await db.get<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    table
  );
  return Boolean(row);
}

async function hasColumn(db: Database, table: string, column: string): Promise<boolean> {
  const columns = await db.all<Array<{ name: string }>>(`PRAGMA table_info(${table})`);
  return columns.some((item) => item.name === column);
}

async function addColumnIfMissing(
  db: Database,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  if (!await hasColumn(db, table, column)) {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
