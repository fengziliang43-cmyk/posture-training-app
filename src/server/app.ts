import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig, type ServerConfig } from "./config";
import { openAppDatabase } from "./db";
import { createRepositories } from "./repositories";
import { registerAiRoutes } from "./routes/ai";
import { registerAuthRoutes } from "./routes/auth";
import { registerBackupRoutes } from "./routes/backup";
import { registerCheckinRoutes } from "./routes/checkins";
import { registerPhotoRoutes } from "./routes/photos";
import { registerPlanRoutes } from "./routes/plans";
import { registerRecordsRoutes } from "./routes/records";
import { registerSettingsRoutes } from "./routes/settings";
import { registerWorkoutRoutes } from "./routes/workouts";

export async function buildApp(options: Partial<ServerConfig> = {}): Promise<FastifyInstance> {
  const config: ServerConfig = { ...loadConfig(), ...options };
  const db = await openAppDatabase(config.databaseFile);
  const repositories = createRepositories(db);
  const sessions = new Map<string, number>();
  const app = Fastify({ logger: false });

  app.addHook("onRequest", (request, reply, done) => {
    const origin = request.headers.origin;
    if (origin) {
      reply.header("Access-Control-Allow-Origin", origin);
      reply.header("Access-Control-Allow-Credentials", "true");
      reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      reply.header("Access-Control-Max-Age", "86400");
      reply.header("Vary", "Origin");
    }

    if (request.method === "OPTIONS") {
      reply.code(204).send();
      return;
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
  await app.register(cookie, { secret: config.cookieSecret });
  await app.register(multipart);
  await app.register(fastifyStatic, {
    root: resolve(config.uploadDir),
    prefix: "/uploads/",
    decorateReply: false
  });

  registerAuthRoutes(app, { db, sessions });
  registerCheckinRoutes(app, { repositories, sessions });
  registerPlanRoutes(app, { repositories, sessions });
  registerWorkoutRoutes(app, { repositories, sessions });
  registerRecordsRoutes(app, { repositories, sessions });
  registerPhotoRoutes(app, { repositories, sessions, uploadDir: config.uploadDir });
  registerSettingsRoutes(app, { repositories, sessions });
  registerAiRoutes(app, { repositories, sessions });
  registerBackupRoutes(app, {
    sessions,
    databaseFile: config.databaseFile,
    uploadDir: config.uploadDir
  });
  app.get("/api/health", async () => ({ ok: true }));

  return app;
}
