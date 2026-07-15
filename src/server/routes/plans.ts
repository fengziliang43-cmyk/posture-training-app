import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { explainPlan } from "../../core/plan-explanation";
import { generateDailyPlan } from "../../core/plan-generator";
import type { AppRepositories } from "../repositories";
import { requireAuthenticatedUserId, type SessionStore } from "../auth";

const todayPlanSchema = z.object({
  date: z.string().min(1).optional()
});

interface PlansRouteContext {
  repositories: AppRepositories;
  sessions: SessionStore;
}

export function registerPlanRoutes(app: FastifyInstance, context: PlansRouteContext): void {
  app.post("/api/plans/today", async (request, reply) => {
    const userId = requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const parsed = todayPlanSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }

    const statusDate = parsed.data.date
      ? parsed.data.date
      : (await context.repositories.getLatestCheckin())?.date;

    if (!statusDate) {
      return reply.code(400).send({ error: "missing check-in" });
    }

    const status = await context.repositories.getCheckinByDate(statusDate);
    if (!status) {
      return reply.code(404).send({ error: "check-in not found" });
    }

    const completedMainSessionsThisWeek = await context.repositories.countCompletedMainSessionsThisWeek(
      status.date
    );
    const lastTemplateId = await context.repositories.getLastMainTemplateId(status.date);
    const plan = generateDailyPlan({
      status,
      completedMainSessionsThisWeek,
      lastTemplateId
    });

    const saved = await context.repositories.savePlan(plan);
    return { plan: { ...saved, explanation: explainPlan(saved, status) } };
  });

  app.get("/api/plans/today", async (request, reply) => {
    const userId = requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const date = getRequestDate(request.query);
    const plan = date ? await context.repositories.getPlanByDate(date) : await context.repositories.getLatestPlan();
    if (!plan) {
      return reply.code(404).send({ error: "plan not found" });
    }

    const status = await context.repositories.getCheckinByDate(plan.date);
    return { plan: { ...plan, explanation: explainPlan(plan, status) } };
  });

  app.post("/api/plans/:planId/exercises/:exerciseId/replace", async (request, reply) => {
    const userId = requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const { planId, exerciseId } = request.params as Record<string, string>;
    const parsedPlanId = Number(planId);
    if (!Number.isInteger(parsedPlanId) || parsedPlanId <= 0 || !exerciseId) {
      return reply.code(400).send({ error: "invalid plan or exercise" });
    }

    try {
      const plan = await context.repositories.replacePlanExercise(parsedPlanId, exerciseId);
      const status = await context.repositories.getCheckinByDate(plan.date);
      return { plan: { ...plan, explanation: explainPlan(plan, status) } };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "replace failed" });
    }
  });

  app.post("/api/plans/:planId/exercises/:exerciseId/revert", async (request, reply) => {
    const userId = requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const { planId, exerciseId } = request.params as Record<string, string>;
    const parsedPlanId = Number(planId);
    if (!Number.isInteger(parsedPlanId) || parsedPlanId <= 0 || !exerciseId) {
      return reply.code(400).send({ error: "invalid plan or exercise" });
    }

    try {
      const plan = await context.repositories.revertPlanExercise(parsedPlanId, exerciseId);
      const status = await context.repositories.getCheckinByDate(plan.date);
      return { plan: { ...plan, explanation: explainPlan(plan, status) } };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "revert failed" });
    }
  });
}

function getRequestDate(query: unknown): string | undefined {
  if (!query || typeof query !== "object") {
    return undefined;
  }

  const value = (query as Record<string, unknown>).date;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
