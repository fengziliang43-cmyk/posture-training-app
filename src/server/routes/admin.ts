import type { FastifyInstance } from "fastify";
import type { AppDatabase } from "../db";
import { requireAuthenticatedUserId, type SessionStore } from "../auth";

interface AdminRouteContext {
  db: AppDatabase;
  sessions: SessionStore;
}

interface AdminStatsRow {
  total_users: number;
  new_users_7d: number;
  new_users_30d: number;
  onboarded_users: number;
  active_users_7d: number;
  active_users_30d: number;
  checkins_7d: number;
  completed_workouts_7d: number;
  completed_workouts_total: number;
}

export function registerAdminRoutes(app: FastifyInstance, context: AdminRouteContext): void {
  app.get("/api/admin/stats", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) return;

    const admin = await context.db.get<{ role: string; status: string }>(
      "SELECT role, status FROM users WHERE id = ?",
      userId
    );
    if (!admin || admin.role !== "admin" || admin.status !== "active") {
      return reply.code(404).send({ error: "not found" });
    }

    const row = await context.db.get<AdminStatsRow>(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE status = 'active') AS total_users,
        (SELECT COUNT(*) FROM users WHERE status = 'active' AND created_at >= datetime('now', '-7 days')) AS new_users_7d,
        (SELECT COUNT(*) FROM users WHERE status = 'active' AND created_at >= datetime('now', '-30 days')) AS new_users_30d,
        (SELECT COUNT(*) FROM user_profiles p JOIN users u ON u.id = p.user_id WHERE u.status = 'active') AS onboarded_users,
        (SELECT COUNT(DISTINCT s.user_id) FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.status = 'active' AND s.last_seen_at >= datetime('now', '-7 days')) AS active_users_7d,
        (SELECT COUNT(DISTINCT s.user_id) FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.status = 'active' AND s.last_seen_at >= datetime('now', '-30 days')) AS active_users_30d,
        (SELECT COUNT(*) FROM checkins WHERE created_at >= datetime('now', '-7 days')) AS checkins_7d,
        (SELECT COUNT(*) FROM workout_logs WHERE completion_status = 'completed' AND completed_at >= datetime('now', '-7 days')) AS completed_workouts_7d,
        (SELECT COUNT(*) FROM workout_logs WHERE completion_status = 'completed') AS completed_workouts_total
    `);

    return {
      generatedAt: new Date().toISOString(),
      users: {
        total: row?.total_users ?? 0,
        new7d: row?.new_users_7d ?? 0,
        new30d: row?.new_users_30d ?? 0,
        onboarded: row?.onboarded_users ?? 0,
        active7d: row?.active_users_7d ?? 0,
        active30d: row?.active_users_30d ?? 0
      },
      activity: {
        checkins7d: row?.checkins_7d ?? 0,
        completedWorkouts7d: row?.completed_workouts_7d ?? 0,
        completedWorkoutsTotal: row?.completed_workouts_total ?? 0
      },
      traffic: {
        available: false,
        provider: "goaccess"
      }
    };
  });
}
