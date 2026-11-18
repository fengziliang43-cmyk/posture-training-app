import type { FastifyInstance } from "fastify";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { formatLocalDate } from "../../core/date";
import { hasRedFlag } from "../../core/readiness";
import { requireAuthenticatedUserId, type SessionStore } from "../auth";
import { ReadTokenLimitError, type AppRepositories } from "../repositories";
import { FixedWindowRateLimiter } from "./auth";

const createReadTokenSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional()
  })
  .strict();

interface ReadTokenRouteContext {
  repositories: AppRepositories;
  sessions: SessionStore;
}

export function registerReadTokenRoutes(app: FastifyInstance, context: ReadTokenRouteContext): void {
  const exportLimiter = new FixedWindowRateLimiter(60, 60 * 60_000);

  app.get("/api/read-tokens", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) return;

    const tokens = await context.repositories.forUser(userId).listReadTokens();
    return { tokens };
  });

  app.post("/api/read-tokens", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) return;

    const parsed = createReadTokenSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }

    const name = parsed.data.name ?? "中控台";
    const token = `zx_${randomBytes(24).toString("base64url")}`;
    const tokenHash = hashReadToken(token);

    try {
      const created = await context.repositories.forUser(userId).createReadToken(name, tokenHash);
      return reply.code(201).send({ token, ...created });
    } catch (error) {
      if (error instanceof ReadTokenLimitError) {
        return reply.code(409).send({ error: "最多 5 把有效钥匙，先作废一把" });
      }
      throw error;
    }
  });

  app.delete("/api/read-tokens/:id", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) return;

    const tokenId = Number((request.params as Record<string, string>).id);
    if (!Number.isInteger(tokenId) || tokenId <= 0) {
      return reply.code(400).send({ error: "invalid token id" });
    }

    const revoked = await context.repositories.forUser(userId).revokeReadToken(tokenId);
    if (revoked === 0) {
      return reply.code(404).send({ error: "not found" });
    }

    return { ok: true };
  });

  app.get("/api/export/summary", { logLevel: "silent" }, async (request, reply) => {
    const bearer = getBearerToken(request.headers.authorization);
    if (!bearer) {
      return reply.code(401).send({ error: "invalid token" });
    }

    const match = await context.repositories.findReadToken(hashReadToken(bearer));
    if (!match) {
      return reply.code(401).send({ error: "invalid token" });
    }

    if (!exportLimiter.consume(String(match.id))) {
      return reply.code(429).send({ error: "too many requests" });
    }

    await context.repositories.touchReadToken(match.id);

    const today = formatLocalDate();
    const summary = await context.repositories.forUser(match.userId).getRecordsSummary(today);
    const weekStart = summary.weeklyReview.weekStart;
    const weekEnd = summary.weeklyReview.weekEnd;
    const monthPrefix = today.slice(0, 7);
    const cutoffDate = subtractDaysIso(today, 13);

    const weekTrainedDates = summary.trainedDates.filter(
      (date) => date >= weekStart && date <= weekEnd
    );
    const monthTrainedDates = summary.trainedDates.filter((date) => date.startsWith(monthPrefix));
    const days = summary.checkins
      .filter((checkin) => checkin.date >= cutoffDate && checkin.date <= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14)
      .map((checkin) => ({
        date: checkin.date,
        lowBackPain: checkin.lowBackPain,
        neckShoulderPain: checkin.neckShoulderPain ?? null,
        energy: checkin.energy,
        redFlag: hasRedFlag(checkin)
      }));

    const latestProgression = [...summary.progressionRecords].sort((a, b) =>
      b.date.localeCompare(a.date)
    )[0];

    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      today,
      week: {
        start: weekStart,
        end: weekEnd,
        trainedDates: weekTrainedDates,
        recommendation: summary.weeklyReview.recommendation ?? null
      },
      month: {
        month: monthPrefix,
        trainedDates: monthTrainedDates
      },
      days,
      lastAdjustment: latestProgression
        ? { date: latestProgression.date, reason: latestProgression.reason }
        : null
    };
  });
}

function getBearerToken(authorization: string | string[] | undefined): string | null {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!value || !value.startsWith("Bearer ")) return null;
  const token = value.slice("Bearer ".length).trim();
  return token || null;
}

function hashReadToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function subtractDaysIso(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() - days);
  return parsed.toISOString().slice(0, 10);
}
