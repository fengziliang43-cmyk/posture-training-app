import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppDatabase } from "../db";
import {
  createSessionToken,
  clearSessionCookie,
  getAuthenticatedUserId,
  getSessionToken,
  hashPassword,
  SESSION_COOKIE_NAME,
  type SessionStore,
  verifyPassword
} from "../auth";

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9_.-]+$/);
const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(6).max(128)
});
const registerSchema = z.object({
  username: usernameSchema,
  password: z.string().min(10).max(128),
  adultConfirmed: z.literal(true),
  termsAccepted: z.literal(true)
});

interface AuthRouteContext {
  db: AppDatabase;
  sessions: SessionStore;
  secureCookies: boolean;
  legacySetupEnabled: boolean;
  registrationEnabled: boolean;
  sessionTtlHours: number;
}

export function registerAuthRoutes(app: FastifyInstance, context: AuthRouteContext): void {
  const loginLimiter = new FixedWindowRateLimiter(10, 15 * 60_000);
  const registerLimiter = new FixedWindowRateLimiter(5, 60 * 60_000);

  app.get("/api/auth/capabilities", async () => ({
    registrationEnabled: context.registrationEnabled
  }));

  app.post("/api/auth/register", async (request, reply) => {
    if (!context.registrationEnabled) {
      return reply.code(404).send({ error: "not found" });
    }
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid registration" });
    }

    const usernameNormalized = normalizeUsername(parsed.data.username);
    if (!registerLimiter.consume(request.ip)) {
      return reply.code(429).send({ error: "too many attempts" });
    }

    const existing = await context.db.get<{ id: number }>(
      "SELECT id FROM users WHERE username_normalized = ?",
      usernameNormalized
    );
    if (existing) {
      return reply.code(409).send({ error: "username unavailable" });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await context.db.exec("BEGIN IMMEDIATE");
    try {
      const result = await context.db.run(
        `INSERT INTO users (username, username_normalized, password_hash)
         VALUES (?, ?, ?)`,
        parsed.data.username.trim(),
        usernameNormalized,
        passwordHash
      );
      const userId = result.lastID ?? 0;
      await context.db.run(
        `INSERT INTO user_consents (user_id, consent_type, policy_version)
         VALUES (?, 'terms', '2026-08-09-v1')`,
        userId
      );
      await context.db.exec("COMMIT");
      return establishSession(request, reply, context, {
        id: userId,
        username: parsed.data.username.trim(),
        onboardingCompleted: false
      });
    } catch (error) {
      await context.db.exec("ROLLBACK");
      if (isUniqueConstraintError(error)) {
        return reply.code(409).send({ error: "username unavailable" });
      }
      throw error;
    }
  });

  app.post("/api/auth/setup", async (request, reply) => {
    if (!context.legacySetupEnabled) {
      return reply.code(404).send({ error: "not found" });
    }
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }
    const existing = await context.db.get<{ count: number }>("SELECT COUNT(*) AS count FROM users");
    if ((existing?.count ?? 0) > 0) {
      return reply.code(409).send({ error: "user already exists" });
    }

    const usernameNormalized = normalizeUsername(parsed.data.username);
    const passwordHash = await hashPassword(parsed.data.password);
    const result = await context.db.run(
      `INSERT INTO users (username, username_normalized, password_hash, role)
       VALUES (?, ?, ?, 'admin')`,
      parsed.data.username.trim(),
      usernameNormalized,
      passwordHash
    );
    const userId = result.lastID ?? 0;
    await createLegacyOwnerProfile(context.db, userId);
    return establishSession(request, reply, context, {
      id: userId,
      username: parsed.data.username.trim(),
      onboardingCompleted: true
    });
  });

  app.post("/api/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid credentials" });
    }
    const usernameNormalized = normalizeUsername(parsed.data.username);
    if (!loginLimiter.consume(`${request.ip}:${usernameNormalized}`)) {
      return reply.code(429).send({ error: "too many attempts" });
    }

    const user = await context.db.get<{
      id: number;
      username: string;
      password_hash: string;
      status: string;
    }>(
      `SELECT id, username, password_hash, status
         FROM users WHERE username_normalized = ?`,
      usernameNormalized
    );
    const passwordMatches = user
      ? await verifyPassword(parsed.data.password, user.password_hash)
      : false;
    if (!user || !passwordMatches || user.status !== "active") {
      return reply.code(401).send({ error: "invalid credentials" });
    }

    const profile = await context.db.get<{ completed_at: string }>(
      "SELECT completed_at FROM user_profiles WHERE user_id = ?",
      user.id
    );
    return establishSession(request, reply, context, {
      id: user.id,
      username: user.username,
      onboardingCompleted: Boolean(profile?.completed_at)
    });
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const token = getSessionToken(request);
    if (token) await context.sessions.delete(token);
    clearSessionCookie(reply, context.secureCookies);
    return { ok: true };
  });

  app.get("/api/auth/me", async (request, reply) => {
    const userId = await getAuthenticatedUserId(request, context.sessions);
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const user = await context.db.get<{ id: number; username: string; status: string }>(
      "SELECT id, username, status FROM users WHERE id = ?",
      userId
    );
    if (!user || user.status !== "active") {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const profile = await context.db.get<{ completed_at: string }>(
      "SELECT completed_at FROM user_profiles WHERE user_id = ?",
      userId
    );
    return {
      user: {
        id: user.id,
        username: user.username,
        onboardingCompleted: Boolean(profile?.completed_at)
      }
    };
  });
}

async function establishSession(
  request: FastifyRequest,
  reply: FastifyReply,
  context: AuthRouteContext,
  user: { id: number; username: string; onboardingCompleted: boolean }
) {
  const sessionToken = createSessionToken();
  await context.sessions.set(sessionToken, user.id);
  setSessionCookie(reply, sessionToken, context.secureCookies, context.sessionTtlHours);
  const nativeClient = request.headers["x-zixu-client"] === "native";
  return nativeClient ? { user, sessionToken } : { user };
}

function setSessionCookie(
  reply: FastifyReply,
  sessionToken: string,
  secure: boolean,
  sessionTtlHours: number
): void {
  reply.setCookie(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure,
    signed: true,
    sameSite: "strict",
    path: "/",
    maxAge: Math.max(1, Math.floor(sessionTtlHours * 60 * 60))
  });
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

async function createLegacyOwnerProfile(db: AppDatabase, userId: number): Promise<void> {
  await db.run(
    `INSERT INTO user_profiles (
      user_id, age_range, fitness_level, goals_json, equipment_json,
      weekly_training_days, default_session_minutes, can_walk_20_minutes,
      can_chair_stand, can_hold_support_20_seconds, limitations_json,
      onboarding_version, completed_at
    ) VALUES (?, '18-29', 'regular', ?, ?, 3, 45, 1, 1, 1, '[]', 'legacy-v1', CURRENT_TIMESTAMP)`,
    userId,
    JSON.stringify(["safe-movement", "posture"]),
    JSON.stringify(["bodyweight", "floor", "pull-up-bar", "resistance-band", "wall", "step", "walking-space"])
  );
}

export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, { count: number; resetAt: number }>();
  private consumeCount = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxEntries = 10_000,
    private readonly now = Date.now
  ) {
    if (limit < 1 || windowMs < 1 || maxEntries < 1) {
      throw new Error("Rate limiter values must be positive.");
    }
  }

  consume(key: string): boolean {
    const now = this.now();
    const current = this.entries.get(key);
    if (current && current.resetAt > now) {
      if (current.count >= this.limit) return false;
      current.count += 1;
      return true;
    }

    if (current) this.entries.delete(key);
    this.consumeCount += 1;
    if (this.consumeCount % 64 === 0 || this.entries.size >= this.maxEntries) {
      this.removeExpiredEntries(now);
    }
    if (this.entries.size >= this.maxEntries) return false;

    this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
    return true;
  }

  private removeExpiredEntries(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
  }
}
