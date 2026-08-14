import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppDatabase } from "./db";

export const SESSION_COOKIE_NAME = "zixu_session";

export function clearSessionCookie(reply: FastifyReply, secure: boolean): void {
  reply.clearCookie(SESSION_COOKIE_NAME, { path: "/", secure, sameSite: "strict" });
}

export interface SessionStore {
  set: (token: string, userId: number) => Promise<void>;
  get: (token: string) => Promise<number | null>;
  delete: (token: string) => Promise<void>;
  deleteForUser: (userId: number) => Promise<void>;
}

export function createPersistentSessionStore(
  db: AppDatabase,
  ttlHours = 24 * 30
): SessionStore {
  return {
    async set(token, userId) {
      const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
      await db.run(
        `INSERT INTO sessions (token_hash, user_id, expires_at)
         VALUES (?, ?, ?)
         ON CONFLICT(token_hash) DO UPDATE SET
           user_id = excluded.user_id,
           expires_at = excluded.expires_at,
           last_seen_at = CURRENT_TIMESTAMP`,
        hashSessionToken(token),
        userId,
        expiresAt
      );
    },
    async get(token) {
      const tokenHash = hashSessionToken(token);
      const row = await db.get<{ user_id: number; expires_at: string }>(
        "SELECT user_id, expires_at FROM sessions WHERE token_hash = ?",
        tokenHash
      );
      if (!row) return null;
      if (Date.parse(row.expires_at) <= Date.now()) {
        await db.run("DELETE FROM sessions WHERE token_hash = ?", tokenHash);
        return null;
      }
      await db.run(
        "UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = ?",
        tokenHash
      );
      return row.user_id;
    },
    async delete(token) {
      await db.run("DELETE FROM sessions WHERE token_hash = ?", hashSessionToken(token));
    },
    async deleteForUser(userId) {
      await db.run("DELETE FROM sessions WHERE user_id = ?", userId);
    }
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function getSessionToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  const authorizationValue = Array.isArray(authorization) ? authorization[0] : authorization;
  if (authorizationValue?.startsWith("Bearer ")) {
    return authorizationValue.slice("Bearer ".length).trim();
  }

  const cookie = request.cookies[SESSION_COOKIE_NAME];
  if (!cookie) return undefined;
  const unsigned = request.unsignCookie(cookie);
  return unsigned.valid ? unsigned.value : undefined;
}

export async function getAuthenticatedUserId(
  request: FastifyRequest,
  sessions: SessionStore
): Promise<number | null> {
  const token = getSessionToken(request);
  if (!token) return null;
  return sessions.get(token);
}

export async function requireAuthenticatedUserId(
  request: FastifyRequest,
  reply: FastifyReply,
  sessions: SessionStore
): Promise<number | null> {
  const userId = await getAuthenticatedUserId(request, sessions);
  if (!userId) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }

  return userId;
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
