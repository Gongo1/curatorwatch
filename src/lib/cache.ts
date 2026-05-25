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

// ── In-memory fallback cache ──
// Used when Redis is unavailable (local dev, Redis down, etc.)
const memCache = new Map<string, { data: string; expiresAt: number }>();

function memGet<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return JSON.parse(entry.data) as T;
}

function memSet(key: string, data: unknown, ttlSeconds: number): void {
  memCache.set(key, {
    data: JSON.stringify(data),
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  // Try Redis first
  if (redis) {
    try {
      const data = await redis.get(key);
      if (data) return JSON.parse(data) as T;
    } catch {
      // Fall through to memory cache
    }
  }

  // Fallback to in-memory
  return memGet<T>(key);
}

export async function cacheSet(
  key: string,
  data: unknown,
  ttlSeconds: number
): Promise<void> {
  // Always write to memory cache
  memSet(key, data, ttlSeconds);

  // Also write to Redis if available
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
    } catch {
      // Graceful degradation — memory cache is still set
    }
  }
}
