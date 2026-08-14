import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { z } from "zod";
import type { AppRepositories } from "../repositories";
import { requireAuthenticatedUserId, type SessionStore } from "../auth";
import { formatLocalDate } from "../../core/date";
import { isoDateSchema } from "../validation";
import { getProfile } from "./profile";

interface PhotosRouteContext {
  repositories: AppRepositories;
  sessions: SessionStore;
  uploadDir: string;
}

const angles = ["front", "side", "back"] as const;
const photoFieldsSchema = z.object({
  photoDate: isoDateSchema.default(formatLocalDate()),
  angle: z.enum(angles).default("front"),
  note: z.string().max(200).optional()
});
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function registerPhotoRoutes(app: FastifyInstance, context: PhotosRouteContext): void {
  app.post("/api/photos", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }
    const profile = await getProfile(context.repositories.db, userId);
    if (!profile?.completedAt) {
      return reply.code(409).send({ error: "onboarding required", code: "ONBOARDING_REQUIRED" });
    }

    const fields: Record<string, string> = {};
    let fileBuffer: Buffer | undefined;
    let fileName = "photo";
    let mimeType = "application/octet-stream";

    try {
      for await (const part of request.parts()) {
        if (part.type === "file") {
          fileBuffer = await part.toBuffer();
          fileName = part.filename || fileName;
          mimeType = (part.mimetype || mimeType).toLowerCase();
        } else {
          fields[part.fieldname] = String(part.value);
        }
      }
    } catch (error) {
      if (isMultipartLimitError(error)) {
        return reply.code(413).send({ error: "photo is too large" });
      }
      throw error;
    }

    if (!fileBuffer) {
      return reply.code(400).send({ error: "missing file" });
    }

    if (!allowedMimeTypes.has(mimeType)) {
      return reply.code(415).send({ error: "unsupported image type" });
    }

    const parsedFields = photoFieldsSchema.safeParse(fields);
    if (!parsedFields.success) {
      return reply.code(400).send({ error: "invalid photo metadata" });
    }

    const savedName = `${Date.now()}-${randomUUID()}-${sanitizeFileName(fileName)}`;
    const userUploadDir = resolve(context.uploadDir, String(userId));
    const relativePath = `${userId}/${savedName}`;
    const savedPath = resolve(userUploadDir, savedName);

    try {
      await mkdir(userUploadDir, { recursive: true });
      await writeFile(savedPath, fileBuffer);
      const photo = await context.repositories.forUser(userId).savePhoto({
        photoDate: parsedFields.data.photoDate,
        angle: parsedFields.data.angle,
        filePath: relativePath,
        mimeType,
        note: parsedFields.data.note
      });

      return { photo };
    } catch (error) {
      await rm(savedPath, { force: true });
      throw error;
    }
  });

  app.get("/api/photos", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const photos = await context.repositories.forUser(userId).listPhotos();
    return { photos };
  });

  app.put("/api/photos/:id/note", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const photoId = Number((request.params as Record<string, string>).id);
    if (!Number.isInteger(photoId) || photoId <= 0) {
      return reply.code(400).send({ error: "invalid photo id" });
    }

    const parsed = z.object({ note: z.string().max(200).default("") }).safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }

    try {
      const photo = await context.repositories.forUser(userId).updatePhotoNote(photoId, parsed.data.note);
      return { photo };
    } catch {
      return reply.code(404).send({ error: "photo not found" });
    }
  });

  app.get("/api/photos/:id/file", async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const photoId = Number((request.params as Record<string, string>).id);
    if (!Number.isInteger(photoId) || photoId <= 0) {
      return reply.code(400).send({ error: "invalid photo id" });
    }

    const photo = await context.repositories.forUser(userId).getPhotoById(photoId);
    if (!photo) {
      return reply.code(404).send({ error: "photo not found" });
    }

    const uploadRoot = resolve(context.uploadDir);
    const filePath = resolve(uploadRoot, photo.filePath);
    if (!filePath.startsWith(`${uploadRoot}${sep}`)) {
      return reply.code(404).send({ error: "photo not found" });
    }
    reply.type(photo.mimeType);
    return createReadStream(filePath);
  });
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function isMultipartLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === "FST_REQ_FILE_TOO_LARGE" || code === "FST_FILES_LIMIT";
}
