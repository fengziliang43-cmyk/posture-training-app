import sqlite3 from "sqlite3";
import { open, type Database } from "sqlite";
import { runMigrations } from "./migrations";

export type AppDatabase = Database;

export async function openAppDatabase(databaseFile: string): Promise<AppDatabase> {
  const db = await open({
    filename: databaseFile,
    driver: sqlite3.Database
  });

  await runMigrations(db);
  return db;
}
