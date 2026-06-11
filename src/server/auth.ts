import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

export const SESSION_COOKIE_NAME = "pt_session";

export type SessionStore = Map<string, number>;

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
  return request.cookies[SESSION_COOKIE_NAME];
}

export function getAuthenticatedUserId(request: FastifyRequest, sessions: SessionStore): number | null {
  const token = getSessionToken(request);
  if (!token) {
    return null;
  }

  return sessions.get(token) ?? null;
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
