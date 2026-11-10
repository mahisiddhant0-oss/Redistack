import { redis } from "./redis-client";
import { RateLimiter } from "./rate-limiter";

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main(): Promise<void> {
  const rateLimiter = new RateLimiter(redis);
  const key = "rate-limit:fixed:demo-ip";
  const limit = 5;
  const windowSeconds = 10;

  await redis.del(key);

  const firstResult = await rateLimiter.check(key, limit, windowSeconds);
  const firstTtl = await redis.ttl(key);

  console.log("First request", {
    allowed: firstResult.allowed,
    remaining: firstResult.remaining,
    ttlSeconds: firstTtl,
  });

  await wait(2_000);

  const secondResult = await rateLimiter.check(key, limit, windowSeconds);
  const secondTtl = await redis.ttl(key);

  console.log("Second request", {
    allowed: secondResult.allowed,
    remaining: secondResult.remaining,
    ttlSeconds: secondTtl,
  });

  console.log(
    "Fixed: the TTL counts down instead of being reset on every request."
  );

  await redis.quit();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});