import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuthenticatedUserId, type SessionStore } from "../auth";
import type { AppRepositories } from "../repositories";
import { isoDateSchema } from "../validation";

interface RecordsRouteContext {
  repositories: AppRepositories;
  sessions: SessionStore;
}

const recordsQuerySchema = z.object({ date: isoDateSchema.optional() });

export function registerRecordsRoutes(app: FastifyInstance, context: RecordsRouteContext): void {
  app.get("/api/records/summary", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const query = recordsQuerySchema.safeParse(request.query ?? {});
    if (!query.success) {
      return reply.code(400).send({ error: "invalid query" });
    }

    const queryDate = query.data.date;
    const repositories = context.repositories.forUser(userId);
    const date = queryDate ?? (await repositories.getLatestCheckin())?.date;
    if (!date) {
      return reply.code(404).send({ error: "no records" });
    }

    const summary = await repositories.getRecordsSummary(date);
    return { summary };
  });
}
