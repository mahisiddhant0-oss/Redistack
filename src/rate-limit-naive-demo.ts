import { redis } from "./redis-client";

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main(): Promise<void> {
  const key = "rate-limit:naive:demo-ip";
  const windowSeconds = 10;

  await redis.del(key);

  const firstCount = await redis.incr(key);
  await redis.expire(key, windowSeconds);
  const firstTtl = await redis.ttl(key);

  console.log("First request", { count: firstCount, ttlSeconds: firstTtl });

  await wait(2_000);

  const secondCount = await redis.incr(key);
  await redis.expire(key, windowSeconds);
  const secondTtl = await redis.ttl(key);

  console.log("Second request", { count: secondCount, ttlSeconds: secondTtl });
  console.log(
    "Problem: the TTL is close to 10 again, so every request extends the window."
  );

  await redis.quit();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
