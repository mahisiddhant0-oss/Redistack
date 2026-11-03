import { randomUUID } from "node:crypto";
import type Redis from "ioredis";

export type Session = {
  sessionId: string;
  userId: string;
  email: string;
  role: string;
};

export class SessionStore {
  constructor(private readonly redis: Redis) {}

  async create(
    userId: string,
    email: string,
    role: string,
    ttlSeconds = 300
  ): Promise<string> {
    const sessionId = randomUUID();
    const key = `session:${sessionId}`;

    await this.redis.hset(key, {
      userId,
      email,
      role,
    });

    await this.redis.expire(key, ttlSeconds);

    return sessionId;
  }

  async get(sessionId: string): Promise<Session | null> {
    const key = `session:${sessionId}`;
    const data = await this.redis.hgetall(key);

    if (Object.keys(data).length === 0) {
      return null;
    }

    return {
      sessionId,
      userId: data.userId,
      email: data.email,
      role: data.role,
    };
  }


  async refresh(sessionId: string, ttlSeconds = 300): Promise<boolean> {
  const key = `session:${sessionId}`;
  const result = await this.redis.expire(key, ttlSeconds);

  return result === 1;
}

    async destroy(sessionId: string): Promise<boolean> {
    const key = `session:${sessionId}`;
    const result = await this.redis.del(key);

    return result === 1;
    }

    
}