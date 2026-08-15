import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppRepositories } from "../repositories";
import { requireAuthenticatedUserId, type SessionStore } from "../auth";

const settingsSchema = z
  .object({
    notificationsEnabled: z.boolean().optional(),
    deepseekEnabled: z.boolean().optional(),
    deepseekModel: z.string().trim().min(1).max(80).optional()
  })
  .strict();
const deepseekKeySchema = z.object({
  apiKey: z.string().trim().min(1).max(512),
  model: z.string().trim().min(1).max(80).optional()
});

interface SettingsRouteContext {
  repositories: AppRepositories;
  sessions: SessionStore;
  deepseekUserKeysEnabled: boolean;
}

export function registerSettingsRoutes(app: FastifyInstance, context: SettingsRouteContext): void {
  app.get("/api/settings", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const settings = await context.repositories.forUser(userId).getSettings();
    return { settings: { ...settings, deepseekAvailable: context.deepseekUserKeysEnabled } };
  });

  app.put("/api/settings", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const parsed = settingsSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }
    if (!context.deepseekUserKeysEnabled &&
      (parsed.data.deepseekEnabled !== undefined || parsed.data.deepseekModel !== undefined)) {
      return reply.code(403).send({ error: "deepseek is unavailable on this deployment" });
    }

    const settings = await context.repositories
      .forUser(userId)
      .setSettings(parsed.data as Record<string, unknown>);
    return { settings: { ...settings, deepseekAvailable: context.deepseekUserKeysEnabled } };
  });

  app.put("/api/settings/deepseek-key", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }
    if (!context.deepseekUserKeysEnabled) {
      return reply.code(404).send({ error: "not found" });
    }

    const parsed = deepseekKeySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }

    const repositories = context.repositories.forUser(userId);
    let settings = await repositories.setDeepseekApiKey(parsed.data.apiKey);
    if (parsed.data.model) {
      settings = await repositories.setSettings({ deepseekModel: parsed.data.model });
    }
    return { settings };
  });

  app.delete("/api/settings/deepseek-key", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }
    if (!context.deepseekUserKeysEnabled) {
      return reply.code(404).send({ error: "not found" });
    }

    const settings = await context.repositories.forUser(userId).clearDeepseekApiKey();
    return { settings };
  });
}
