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
    const sessionKey = `session:${sessionId}`;
    const userSessionsKey = `user-sessions:${userId}`;

    await this.redis.hset(sessionKey, {
      userId,
      email,
      role,
    });

    await this.redis.expire(sessionKey, ttlSeconds);

    await this.redis.sadd(userSessionsKey, sessionId);

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
    const session = await this.get(sessionId);

    if (session === null) {
      return false;
    }

    const sessionKey = `session:${sessionId}`;
    const userSessionsKey = `user-sessions:${session.userId}`;

    await this.redis.del(sessionKey);
    await this.redis.srem(userSessionsKey, sessionId);

    return true;
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const userSessionsKey = `user-sessions:${userId}`;
    const sessionIds = await this.redis.smembers(userSessionsKey);

    if (sessionIds.length === 0) {
      return 0;
    }

    const pipeline = this.redis.multi();

    for (const sessionId of sessionIds) {
      pipeline.del(`session:${sessionId}`);
    }

    pipeline.del(userSessionsKey);

    await pipeline.exec();

    return sessionIds.length;
  }
}
