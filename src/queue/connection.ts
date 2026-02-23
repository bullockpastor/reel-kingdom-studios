import { Redis } from "ioredis";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

let connection: Redis | undefined;

export function getRedisConnection(): Redis {
  if (!connection) {
    connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
    connection.on("error", (err: Error) => {
      logger.error({ err }, "Redis connection error");
    });
  }
  return connection;
}

export async function closeRedis(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = undefined;
  }
}
