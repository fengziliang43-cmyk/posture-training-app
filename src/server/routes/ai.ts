import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { explainPlan, localExplanationText } from "../../core/plan-explanation";
import { requireAuthenticatedUserId, type SessionStore } from "../auth";
import { buildDailyExplanationMessages, buildWeeklyReviewMessages } from "../ai-prompts";
import { createDeepSeekChatCompletion } from "../deepseek";
import type { AppRepositories } from "../repositories";

const planTargetSchema = z.object({
  planId: z.number().int().positive().optional(),
  date: z.string().min(1).optional()
});

interface AiRouteContext {
  repositories: AppRepositories;
  sessions: SessionStore;
}

export function registerAiRoutes(app: FastifyInstance, context: AiRouteContext): void {
  app.post("/api/ai/deepseek/test", async (request, reply) => {
    const userId = requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) return;

    const apiKey = await context.repositories.getDeepseekApiKey();
    const settings = await context.repositories.getSettings();
    if (!apiKey) {
      return reply.code(400).send({ ok: false, error: "deepseek key not configured" });
    }

    const checkedAt = new Date().toISOString();
    try {
      await createDeepSeekChatCompletion({
        apiKey,
        model: String(settings.deepseekModel),
        maxTokens: 128,
        messages: [
          { role: "system", content: "只回复四个字：连接正常" },
          { role: "user", content: "测试连接。" }
        ]
      });
      await context.repositories.updateDeepseekTestStatus(true, checkedAt);
      return { ok: true, checkedAt };
    } catch (error) {
      await context.repositories.updateDeepseekTestStatus(false, checkedAt);
      return reply.code(502).send({
        ok: false,
        checkedAt,
        error: error instanceof Error ? error.message : "DeepSeek request failed."
      });
    }
  });

  app.post("/api/ai/daily-explanation", async (request, reply) => {
    const userId = requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) return;

    const parsed = planTargetSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }

    const plan = parsed.data.planId
      ? await context.repositories.getPlanById(parsed.data.planId)
      : parsed.data.date
        ? await context.repositories.getPlanByDate(parsed.data.date)
        : await context.repositories.getLatestPlan();
    if (!plan) {
      return reply.code(404).send({ error: "plan not found" });
    }

    const status = await context.repositories.getCheckinByDate(plan.date);
    const local = explainPlan(plan, status);
    const settings = await context.repositories.getSettings();
    const apiKey = await context.repositories.getDeepseekApiKey();

    if (!settings.deepseekEnabled || !apiKey) {
      return { explanation: localExplanationText(local), source: "local" };
    }

    try {
      const result = await createDeepSeekChatCompletion({
        apiKey,
        model: String(settings.deepseekModel),
        maxTokens: 640,
        messages: buildDailyExplanationMessages(plan, local)
      });
      return { explanation: limitText(result.content, 180), source: "deepseek" };
    } catch {
      return { explanation: localExplanationText(local), source: "local" };
    }
  });

  app.post("/api/ai/weekly-review", async (request, reply) => {
    const userId = requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) return;

    const parsed = z.object({ date: z.string().min(1).optional() }).safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }

    const date = parsed.data.date ?? (await context.repositories.getLatestCheckin())?.date;
    if (!date) {
      return reply.code(404).send({ error: "no records" });
    }

    const summary = await context.repositories.getRecordsSummary(date);
    const settings = await context.repositories.getSettings();
    const apiKey = await context.repositories.getDeepseekApiKey();

    if (!settings.deepseekEnabled || !apiKey) {
      return { summary: summary.weeklyReview.summary, source: "local" };
    }

    try {
      const result = await createDeepSeekChatCompletion({
        apiKey,
        model: String(settings.deepseekModel),
        maxTokens: 760,
        messages: buildWeeklyReviewMessages(summary.weeklyReview)
      });
      return { summary: limitText(result.content, 220), source: "deepseek" };
    } catch {
      return { summary: summary.weeklyReview.summary, source: "local" };
    }
  });
}

function limitText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
