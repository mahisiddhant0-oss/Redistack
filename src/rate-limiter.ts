import type Redis from "ioredis";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

const FIXED_WINDOW_SCRIPT = `
  local count = redis.call("INCR", KEYS[1])

  if count == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[2])
  end

  local ttl = redis.call("PTTL", KEYS[1])
  local limit = tonumber(ARGV[1])

  if count > limit then
    return {0, count, ttl}
  end

  return {1, count, ttl}
`;

export class RateLimiter {
  constructor(private readonly redis: Redis) {}

  async check(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    const result = (await this.redis.eval(
      FIXED_WINDOW_SCRIPT,
      1,
      key,
      String(limit),
      String(windowSeconds)
    )) as [number, number, number];

    const [allowedValue, count, ttlMilliseconds] = result;
    const allowed = allowedValue === 1;

    return {
      allowed,
      limit,
      remaining: Math.max(limit - count, 0),
      retryAfterSeconds: allowed
        ? 0
        : Math.ceil(Math.max(ttlMilliseconds, 0) / 1000),
    };
  }
}