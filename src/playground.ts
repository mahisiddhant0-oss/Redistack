import Redis from "ioredis";

const redis = new Redis({
  host: "127.0.0.1",
  port: 6380,
});

async function main() {
  await redis.set("user:1:name", "Aarav");

  const name = await redis.get("user:1:name");
  console.log("User name:", name);

  await redis.set(
    "demo:temporary-message",
    "This disappears in 10 seconds",
    "EX",
    10
  );

  const ttl = await redis.ttl("demo:temporary-message");
  console.log("Temporary key expires in:", ttl, "seconds");

  await redis.hset("user:1", {
    name: "Aarav",
    email: "aarav@example.com",
    role: "learner",
  });

  const user = await redis.hgetall("user:1");
  console.log("User profile:", user);

  await redis.quit();
}

main().catch((error) => {
  console.error("Redis error:", error);
  process.exit(1);
});
