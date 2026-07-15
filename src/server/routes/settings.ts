import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppRepositories } from "../repositories";
import { requireAuthenticatedUserId, type SessionStore } from "../auth";

const settingsSchema = z.record(z.any());
const deepseekKeySchema = z.object({
  apiKey: z.string().trim().min(1),
  model: z.string().trim().min(1).optional()
});

interface SettingsRouteContext {
  repositories: AppRepositories;
  sessions: SessionStore;
}

export function registerSettingsRoutes(app: FastifyInstance, context: SettingsRouteContext): void {
  app.get("/api/settings", async (request, reply) => {
    const userId = requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const settings = await context.repositories.getSettings();
    return { settings };
  });

  app.put("/api/settings", async (request, reply) => {
    const userId = requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const parsed = settingsSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }

    const settings = await context.repositories.setSettings(parsed.data as Record<string, unknown>);
    return { settings };
  });

  app.put("/api/settings/deepseek-key", async (request, reply) => {
    const userId = requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const parsed = deepseekKeySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }

    let settings = await context.repositories.setDeepseekApiKey(parsed.data.apiKey);
    if (parsed.data.model) {
      settings = await context.repositories.setSettings({ deepseekModel: parsed.data.model });
    }
    return { settings };
  });

  app.delete("/api/settings/deepseek-key", async (request, reply) => {
    const userId = requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const settings = await context.repositories.clearDeepseekApiKey();
    return { settings };
  });
}
