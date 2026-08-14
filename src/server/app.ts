import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance } from "fastify";
import { mkdir } from "node:fs/promises";
import { assertServerConfig, loadConfig, type ServerConfig } from "./config";
import { openAppDatabase } from "./db";
import { createRepositories } from "./repositories";
import { registerAiRoutes } from "./routes/ai";
import { registerAccountRoutes, retryPendingAccountDeletionCleanup } from "./routes/account";
import { registerAuthRoutes } from "./routes/auth";
import { registerBackupRoutes } from "./routes/backup";
import { registerCheckinRoutes } from "./routes/checkins";
import { registerPhotoRoutes } from "./routes/photos";
import { registerPlanRoutes } from "./routes/plans";
import { registerRecordsRoutes } from "./routes/records";
import { registerSettingsRoutes } from "./routes/settings";
import { registerWorkoutRoutes } from "./routes/workouts";
import { createPersistentSessionStore } from "./auth";
import { registerProfileRoutes } from "./routes/profile";

export async function buildApp(options: Partial<ServerConfig> = {}): Promise<FastifyInstance> {
  const config: ServerConfig = { ...loadConfig(), ...options };
  assertServerConfig(config);
  const db = await openAppDatabase(config.databaseFile);
  const repositories = createRepositories(db);
  const sessions = createPersistentSessionStore(db, config.sessionTtlHours);
  const app = Fastify({
    logger: false,
    trustProxy: config.isProduction ? "127.0.0.1" : false
  });

  app.addHook("onRequest", (request, reply, done) => {
    const origin = request.headers.origin;
    const originAllowed = !origin || config.allowedOrigins.includes(origin);
    if (origin && !originAllowed) {
      reply.code(403).send({ error: "origin not allowed" });
      return;
    }
    if (origin && originAllowed) {
      reply.header("Access-Control-Allow-Origin", origin);
      reply.header("Access-Control-Allow-Credentials", "true");
      reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Zixu-Client");
      reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      reply.header("Access-Control-Max-Age", "86400");
      reply.header("Vary", "Origin");
    }

    if (request.method === "OPTIONS") {
      reply.code(204).send();
      return;
    }

    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    if (request.url.startsWith("/api/")) {
      reply.header("Cache-Control", "no-store");
    }

    done();
  });

  app.decorate("db", db);
  app.decorate("repositories", repositories);
  app.decorate("sessions", sessions);

  app.addHook("onClose", async () => {
    await db.close();
  });

  await mkdir(config.uploadDir, { recursive: true });
  await retryPendingAccountDeletionCleanup(db, config.uploadDir);
  await app.register(cookie, { secret: config.cookieSecret });
  await app.register(multipart, {
    limits: {
      fileSize: config.photoMaxBytes,
      files: 1,
      fields: 8,
      parts: 10
    }
  });

  registerAuthRoutes(app, {
    db,
    sessions,
    secureCookies: config.secureCookies,
    legacySetupEnabled: !config.isProduction,
    registrationEnabled: config.registrationEnabled,
    sessionTtlHours: config.sessionTtlHours
  });
  registerAccountRoutes(app, {
    db,
    sessions,
    uploadDir: config.uploadDir,
    secureCookies: config.secureCookies
  });
  registerProfileRoutes(app, { db, sessions });
  registerCheckinRoutes(app, { repositories, sessions });
  registerPlanRoutes(app, { repositories, sessions });
  registerWorkoutRoutes(app, { repositories, sessions });
  registerRecordsRoutes(app, { repositories, sessions });
  registerPhotoRoutes(app, { repositories, sessions, uploadDir: config.uploadDir });
  registerSettingsRoutes(app, {
    repositories,
    sessions,
    deepseekUserKeysEnabled: config.deepseekUserKeysEnabled
  });
  registerAiRoutes(app, {
    repositories,
    sessions,
    deepseekUserKeysEnabled: config.deepseekUserKeysEnabled
  });
  registerBackupRoutes(app, {
    sessions,
    uploadDir: config.uploadDir,
    db
  });
  app.get("/api/health", async () => ({ ok: true }));

  return app;
}
