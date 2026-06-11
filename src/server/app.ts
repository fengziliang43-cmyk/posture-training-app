import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig, type ServerConfig } from "./config";
import { openAppDatabase } from "./db";
import { createRepositories } from "./repositories";

export async function buildApp(options: Partial<ServerConfig> = {}): Promise<FastifyInstance> {
  const config: ServerConfig = { ...loadConfig(), ...options };
  const db = await openAppDatabase(config.databaseFile);
  const repositories = createRepositories(db);
  const app = Fastify({ logger: false });

  app.decorate("db", db);
  app.decorate("repositories", repositories);

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

  app.get("/api/health", async () => ({ ok: true }));

  return app;
}
