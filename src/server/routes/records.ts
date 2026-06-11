import type { FastifyInstance } from "fastify";
import { requireAuthenticatedUserId, type SessionStore } from "../auth";
import type { AppRepositories } from "../repositories";

interface RecordsRouteContext {
  repositories: AppRepositories;
  sessions: SessionStore;
}

export function registerRecordsRoutes(app: FastifyInstance, context: RecordsRouteContext): void {
  app.get("/api/records/summary", async (request, reply) => {
    const userId = requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const queryDate = getRequestDate(request.query);
    const date = queryDate ?? (await context.repositories.getLatestCheckin())?.date;
    if (!date) {
      return reply.code(404).send({ error: "no records" });
    }

    const summary = await context.repositories.getRecordsSummary(date);
    return { summary };
  });
}

function getRequestDate(query: unknown): string | undefined {
  if (!query || typeof query !== "object") {
    return undefined;
  }

  const value = (query as Record<string, unknown>).date;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
