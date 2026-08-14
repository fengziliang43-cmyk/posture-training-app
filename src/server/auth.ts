import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

export const SESSION_COOKIE_NAME = "pt_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface SessionRecord {
  userId: number;
  expiresAt: number;
}

export type SessionStore = Map<string, SessionRecord>;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function createSession(sessions: SessionStore, userId: number, now = Date.now()): string {
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }

  while (sessions.size >= 100) {
    const oldestToken = sessions.keys().next().value;
    if (!oldestToken) {
      break;
    }
    sessions.delete(oldestToken);
  }

  const token = createSessionToken();
  sessions.set(token, { userId, expiresAt: now + SESSION_TTL_MS });
  return token;
}

export function getSessionToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  const authorizationValue = Array.isArray(authorization) ? authorization[0] : authorization;
  if (authorizationValue?.startsWith("Bearer ")) {
    return authorizationValue.slice("Bearer ".length).trim();
  }

  return request.cookies[SESSION_COOKIE_NAME];
}

export function getAuthenticatedUserId(
  request: FastifyRequest,
  sessions: SessionStore,
  now = Date.now()
): number | null {
  const token = getSessionToken(request);
  if (!token) {
    return null;
  }

  const session = sessions.get(token);
  if (!session) {
    return null;
  }

  if (session.expiresAt <= now) {
    sessions.delete(token);
    return null;
  }

  return session.userId;
}

export function requireAuthenticatedUserId(
  request: FastifyRequest,
  reply: FastifyReply,
  sessions: SessionStore
): number | null {
  const userId = getAuthenticatedUserId(request, sessions);
  if (!userId) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }

  return userId;
}
