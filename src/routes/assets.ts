import type { FastifyInstance } from "fastify";
import { createReadStream, statSync, lstatSync } from "node:fs";
import { join, resolve, normalize, extname } from "node:path";
import { config } from "../config.js";

const ALLOWED_EXTENSIONS = new Set([".mp4", ".webm", ".png", ".jpg", ".jpeg", ".json", ".wav"]);

export async function assetRoutes(app: FastifyInstance) {
  app.get("/*", async (request, reply) => {
    const rawPath = (request.params as { "*": string })["*"];

    if (!rawPath) {
      return reply.status(400).send({ error: "No path specified" });
    }

    // Refuse .. traversal at the string level before resolving
    if (rawPath.includes("..")) {
      return reply.status(403).send({ error: "Access denied" });
    }

    const studioRoot = resolve(config.STUDIO_ROOT);
    const filePath = resolve(join(studioRoot, normalize(rawPath)));

    // Verify resolved path stays within STUDIO_ROOT
    if (!filePath.startsWith(studioRoot + "/")) {
      return reply.status(403).send({ error: "Access denied" });
    }

    // Allowlist file extensions
    const ext = extname(filePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return reply.status(403).send({ error: `File type not allowed: ${ext}` });
    }

    // Refuse symlinks that escape STUDIO_ROOT
    try {
      const lstat = lstatSync(filePath);
      if (lstat.isSymbolicLink()) {
        const realPath = resolve(filePath);
        if (!realPath.startsWith(studioRoot + "/")) {
          return reply.status(403).send({ error: "Access denied" });
        }
      }
    } catch {
      return reply.status(404).send({ error: "File not found" });
    }

    try {
      const stat = statSync(filePath);
      if (!stat.isFile()) {
        return reply.status(404).send({ error: "Not a file" });
      }

      const contentTypes: Record<string, string> = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".json": "application/json",
        ".wav": "audio/wav",
      };

      const contentType = contentTypes[ext] || "application/octet-stream";

      // HTTP range requests for video seeking
      const range = request.headers.range;
      if (range && (ext === ".mp4" || ext === ".webm")) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        reply.status(206);
        reply.header("Content-Range", `bytes ${start}-${end}/${stat.size}`);
        reply.header("Accept-Ranges", "bytes");
        reply.header("Content-Length", chunkSize);
        reply.header("Content-Type", contentType);

        return reply.send(createReadStream(filePath, { start, end }));
      }

      reply.header("Content-Type", contentType);
      reply.header("Content-Length", stat.size);
      reply.header("Accept-Ranges", "bytes");
      return reply.send(createReadStream(filePath));
    } catch {
      return reply.status(404).send({ error: "File not found" });
    }
  });
}
