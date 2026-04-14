import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) return null;

  try {
    return new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
    });
  } catch {
    console.warn("Failed to create Redis client");
    return null;
  }
}

const redis = globalForRedis.redis ?? createRedisClient();
if (redis && !globalForRedis.redis) {
  globalForRedis.redis = redis;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  data: unknown,
  ttlSeconds: number
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
  } catch {
    // Graceful degradation — skip cache write
  }
}
