import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance } from "fastify";
import { mkdir } from "node:fs/promises";
import { assertServerConfig, loadConfig, type ServerConfig } from "./config";
import { openAppDatabase } from "./db";
import { createRepositories } from "./repositories";
import { registerAiRoutes } from "./routes/ai";
import { registerAdminRoutes } from "./routes/admin";
import { registerAccountRoutes, retryPendingAccountDeletionCleanup } from "./routes/account";
import { registerAuthRoutes } from "./routes/auth";
import { registerBackupRoutes } from "./routes/backup";
import { registerCheckinRoutes } from "./routes/checkins";
import { registerPhotoRoutes } from "./routes/photos";
import { registerPlanRoutes } from "./routes/plans";
import { registerRecordsRoutes } from "./routes/records";
import { registerReleaseRoutes } from "./routes/releases";
import { registerSettingsRoutes } from "./routes/settings";
import { registerWorkoutRoutes } from "./routes/workouts";
import { createPersistentSessionStore } from "./auth";
import { AuthCaptchaService } from "./captcha";
import { registerProfileRoutes } from "./routes/profile";

interface AppBuildDependencies {
  captchaCodeFactory?: () => string;
}

export async function buildApp(
  options: Partial<ServerConfig> = {},
  dependencies: AppBuildDependencies = {}
): Promise<FastifyInstance> {
  const config: ServerConfig = { ...loadConfig(), ...options };
  assertServerConfig(config);
  const db = await openAppDatabase(config.databaseFile);
  const repositories = createRepositories(db, config.cookieSecret);
  const sessions = createPersistentSessionStore(db, config.sessionTtlHours);
  const authCaptcha = new AuthCaptchaService({ codeFactory: dependencies.captchaCodeFactory });
  const app = Fastify({
    logger: false,
    trustProxy: config.isProduction ? "127.0.0.1" : false
  });

  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    const content = typeof body === "string" ? body : (body as Buffer).toString("utf-8");
    if (!content || content.trim() === "") {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(content));
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
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
    sessionTtlHours: config.sessionTtlHours,
    captchaEnabled: config.authCaptchaEnabled,
    captcha: authCaptcha
  });
  registerReleaseRoutes(app);
  registerAdminRoutes(app, {
    db,
    sessions,
    trafficDashboardUrl: config.trafficDashboardUrl
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

  app.get("/robots.txt", async (request, reply) => {
    reply.type("text/plain");
    return "User-agent: *\nAllow: /\nAllow: /guide\nAllow: /llms.txt\nDisallow: /api/\nDisallow: /admin\nDisallow: /uploads/\n\nSitemap: https://body.liang111.top/sitemap.xml\n";
  });

  app.get("/sitemap.xml", async (request, reply) => {
    reply.type("application/xml");
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://body.liang111.top/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n  <url>\n    <loc>https://body.liang111.top/#guide</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://body.liang111.top/llms.txt</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n</urlset>\n';
  });

  app.get("/llms.txt", async (request, reply) => {
    reply.type("text/plain; charset=utf-8");
    return "# 姿序 (Zixu)\n\n> 为成年脊柱侧弯人群开发的开源体态记录与保守辅助训练工具。\n\n## 核心定位与医学边界\n- 非医疗与诊断工具：姿序不提供任何医学诊断、脊柱侧弯度数（Cobb 角）测量或矫正治疗承诺。\n- 保守辅助训练：依据状态自适应推荐以核心稳定、肩胛控制、姿势对称感知为主的保守训练。\n- 确定性安全规则：危险信号自动阻断、训练后加重下次降级、全流程常驻停止规则。\n\n## 隐私与开源\n- 体态照片仅存个人账户，不做 AI 视觉诊断，不发送给第三方大模型，支持单张随时删除。\n- 开源协议：MIT License\n- 官网：https://body.liang111.top\n- 侧弯体表自查指南：https://body.liang111.top/#guide\n";
  });

  return app;
}
