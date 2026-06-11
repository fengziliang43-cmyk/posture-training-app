import type { AppDatabase } from "./db";

export interface AppRepositories {
  db: AppDatabase;
}

export function createRepositories(db: AppDatabase): AppRepositories {
  return { db };
}
