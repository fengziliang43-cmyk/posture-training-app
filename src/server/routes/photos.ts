import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { AppRepositories } from "../repositories";
import { requireAuthenticatedUserId, type SessionStore } from "../auth";
import { formatLocalDate } from "../../core/date";

interface PhotosRouteContext {
  repositories: AppRepositories;
  sessions: SessionStore;
  uploadDir: string;
}

export function registerPhotoRoutes(app: FastifyInstance, context: PhotosRouteContext): void {
  app.post("/api/photos", async (request, reply) => {
    const userId = requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const fields: Record<string, string> = {};
    let fileBuffer: Buffer | undefined;
    let fileName = "photo";
    let mimeType = "application/octet-stream";

    for await (const part of request.parts()) {
      if (part.type === "file") {
        fileBuffer = await part.toBuffer();
        fileName = part.filename || fileName;
        mimeType = part.mimetype || mimeType;
      } else {
        fields[part.fieldname] = String(part.value);
      }
    }

    if (!fileBuffer) {
      return reply.code(400).send({ error: "missing file" });
    }

    const savedName = `${Date.now()}-${randomUUID()}-${sanitizeFileName(fileName)}`;
    await writeFile(resolve(context.uploadDir, savedName), fileBuffer);

    const photo = await context.repositories.savePhoto({
      photoDate: fields.photoDate ?? formatLocalDate(),
      angle: fields.angle ?? "front",
      filePath: savedName,
      mimeType,
      note: fields.note
    });

    return { photo };
  });

  app.get("/api/photos", async (request, reply) => {
    const userId = requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const photos = await context.repositories.listPhotos();
    return { photos };
  });

  app.put("/api/photos/:id/note", async (request, reply) => {
    const userId = requireAuthenticatedUserId(request, reply, context.sessions);
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
      const photo = await context.repositories.updatePhotoNote(photoId, parsed.data.note);
      return { photo };
    } catch {
      return reply.code(404).send({ error: "photo not found" });
    }
  });

  app.get("/api/photos/:id/file", async (request, reply) => {
    const userId = requireAuthenticatedUserId(request, reply, context.sessions);
    if (!userId) {
      return;
    }

    const photoId = Number((request.params as Record<string, string>).id);
    if (!Number.isInteger(photoId) || photoId <= 0) {
      return reply.code(400).send({ error: "invalid photo id" });
    }

    const photo = await context.repositories.getPhotoById(photoId);
    if (!photo) {
      return reply.code(404).send({ error: "photo not found" });
    }

    const filePath = resolve(context.uploadDir, photo.filePath);
    reply.type(photo.mimeType);
    return createReadStream(filePath);
  });
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
}
