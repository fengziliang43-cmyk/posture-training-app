import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { explainPlan, localExplanationText } from "../../core/plan-explanation";
import { hasRedFlag } from "../../core/readiness";
import { requireAuthenticatedUserId, type SessionStore } from "../auth";
import { buildDailyExplanationMessages, buildWeeklyReviewMessages } from "../ai-prompts";
import { createDeepSeekChatCompletion } from "../deepseek";
import type { AppRepositories } from "../repositories";
import { isoDateSchema } from "../validation";

const planTargetSchema = z.object({
  planId: z.number().int().positive().optional(),
  date: isoDateSchema.optional()
});

interface AiRouteContext {
  repositories: AppRepositories;
  sessions: SessionStore;
  deepseekUserKeysEnabled: boolean;
}

export function registerAiRoutes(app: FastifyInstance, context: AiRouteContext): void {
  app.post("/api/ai/deepseek/test", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) return;
    if (!context.deepseekUserKeysEnabled) {
      return reply.code(404).send({ error: "not found" });
    }

    const repositories = context.repositories.forUser(userId);
    const apiKey = await repositories.getDeepseekApiKey();
    const settings = await repositories.getSettings();
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
      await repositories.updateDeepseekTestStatus(true, checkedAt);
      return { ok: true, checkedAt };
    } catch (error) {
      await repositories.updateDeepseekTestStatus(false, checkedAt);
      return reply.code(502).send({
        ok: false,
        checkedAt,
        error: error instanceof Error ? error.message : "DeepSeek request failed."
      });
    }
  });

  app.post("/api/ai/daily-explanation", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) return;

    const repositories = context.repositories.forUser(userId);

    const parsed = planTargetSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }

    const plan = parsed.data.planId
      ? await repositories.getPlanById(parsed.data.planId)
      : parsed.data.date
        ? await repositories.getPlanByDate(parsed.data.date)
        : await repositories.getLatestPlan();
    if (!plan) {
      return reply.code(404).send({ error: "plan not found" });
    }

    const status = await repositories.getCheckinByDate(plan.date);
    const local = explainPlan(plan, status);
    const settings = await repositories.getSettings();
    const apiKey = context.deepseekUserKeysEnabled
      ? await repositories.getDeepseekApiKey()
      : undefined;

    const generatedAt = new Date().toISOString();
    if (
      (status ? hasRedFlag(status) : false) ||
      plan.decision.readinessScore === 0 ||
      plan.safetyMessage?.includes("红旗")
    ) {
      return {
        explanation: localExplanationText(local),
        source: "local",
        fallbackReason: "safety_blocked",
        generatedAt
      };
    }
    if (!settings.deepseekEnabled || !apiKey) {
      return {
        explanation: localExplanationText(local),
        source: "local",
        fallbackReason: settings.deepseekEnabled ? "not_configured" : "disabled",
        generatedAt
      };
    }

    try {
      const result = await createDeepSeekChatCompletion({
        apiKey,
        model: String(settings.deepseekModel),
        maxTokens: 640,
        messages: buildDailyExplanationMessages(plan, local)
      });
      return { explanation: limitText(result.content, 180), source: "deepseek", generatedAt };
    } catch {
      return {
        explanation: localExplanationText(local),
        source: "local",
        fallbackReason: "request_failed",
        generatedAt
      };
    }
  });

  app.post("/api/ai/weekly-review", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) return;

    const repositories = context.repositories.forUser(userId);

    const parsed = z.object({ date: isoDateSchema.optional() }).safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }

    const date = parsed.data.date ?? (await repositories.getLatestCheckin())?.date;
    if (!date) {
      return reply.code(404).send({ error: "no records" });
    }

    const summary = await repositories.getRecordsSummary(date);
    const settings = await repositories.getSettings();
    const apiKey = context.deepseekUserKeysEnabled
      ? await repositories.getDeepseekApiKey()
      : undefined;

    const generatedAt = new Date().toISOString();
    if (!settings.deepseekEnabled || !apiKey) {
      return {
        summary: summary.weeklyReview.summary,
        source: "local",
        fallbackReason: settings.deepseekEnabled ? "not_configured" : "disabled",
        generatedAt
      };
    }

    try {
      const result = await createDeepSeekChatCompletion({
        apiKey,
        model: String(settings.deepseekModel),
        maxTokens: 760,
        messages: buildWeeklyReviewMessages(summary.weeklyReview)
      });
      return { summary: limitText(result.content, 220), source: "deepseek", generatedAt };
    } catch {
      return {
        summary: summary.weeklyReview.summary,
        source: "local",
        fallbackReason: "request_failed",
        generatedAt
      };
    }
  });
}

function limitText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
