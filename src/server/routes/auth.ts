import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppDatabase } from "../db";
import {
  createSessionToken,
  getAuthenticatedUserId,
  hashPassword,
  SESSION_COOKIE_NAME,
  type SessionStore,
  verifyPassword
} from "../auth";

const credentialsSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(8).max(128)
});

interface AuthRouteContext {
  db: AppDatabase;
  sessions: SessionStore;
}

export function registerAuthRoutes(app: FastifyInstance, context: AuthRouteContext): void {
  app.post("/api/auth/setup", async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }

    const body = parsed.data;
    const existing = await context.db.get<{ count: number }>("SELECT COUNT(*) AS count FROM users");

    if ((existing?.count ?? 0) > 0) {
      return reply.code(409).send({ error: "user already exists" });
    }

    const passwordHash = await hashPassword(body.password);
    const result = await context.db.run(
      "INSERT INTO users (username, password_hash) VALUES (?, ?)",
      body.username,
      passwordHash
    );

    const sessionToken = createSessionToken();
    context.sessions.set(sessionToken, result.lastID ?? 0);
    setSessionCookie(reply, sessionToken);

    return { user: { id: result.lastID, username: body.username } };
  });

  app.post("/api/auth/login", async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }

    const body = parsed.data;
    const user = await context.db.get<{ id: number; username: string; password_hash: string }>(
      "SELECT id, username, password_hash FROM users WHERE username = ?",
      body.username
    );

    if (!user) {
      return reply.code(401).send({ error: "invalid credentials" });
    }

    const passwordMatches = await verifyPassword(body.password, user.password_hash);
    if (!passwordMatches) {
      return reply.code(401).send({ error: "invalid credentials" });
    }

    const sessionToken = createSessionToken();
    context.sessions.set(sessionToken, user.id);
    setSessionCookie(reply, sessionToken);

    return { user: { id: user.id, username: user.username } };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (token) {
      context.sessions.delete(token);
    }

    clearSessionCookie(reply);
    return { ok: true };
  });

  app.get("/api/auth/me", async (request, reply) => {
    const userId = getAuthenticatedUserId(request, context.sessions);
    if (!userId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const user = await context.db.get<{ id: number; username: string }>(
      "SELECT id, username FROM users WHERE id = ?",
      userId
    );

    if (!user) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    return { user };
  });
}

function setSessionCookie(reply: FastifyReply, sessionToken: string): void {
  reply.setCookie(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });
}

function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
}
