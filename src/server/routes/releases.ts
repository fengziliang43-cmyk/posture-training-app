import type { FastifyInstance } from "fastify";
import { LATEST_RELEASE_MANIFEST } from "../../release";

export function registerReleaseRoutes(app: FastifyInstance): void {
  app.get("/api/releases/latest", async () => LATEST_RELEASE_MANIFEST);
}
