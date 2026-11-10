import type Redis from "ioredis";

export class CacheStore {
  constructor(private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const cachedValue = await this.redis.get(key);

    if (cachedValue === null) {
      return null;
    }

    return JSON.parse(cachedValue) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  async delete(key: string): Promise<boolean> {
    const deletedKeys = await this.redis.del(key);

    return deletedKeys === 1;
  }

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const cachedValue = await this.get<T>(key);

    if (cachedValue !== null) {
      console.log("Cache hit:", key);
      return cachedValue;
    }

    console.log("Cache miss:", key);

    const freshValue = await fetcher();
    await this.set(key, freshValue, ttlSeconds);

    return freshValue;
  }
}