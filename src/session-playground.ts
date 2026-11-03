import Redis from "ioredis";

const redis = new Redis({
    host : "127.0.0.1",
    port : 6380,
});

async function main() {

    const sessionId = "session:demo-123";

    await redis.hset(
        sessionId,
        "userId",
        "1",
        "email",
        "aarav@example.com",
        "role",
        "learner"
    );

    await redis.expire(sessionId,300);
    const session = await redis.hgetall(sessionId);
    const ttl = await redis.ttl(sessionId);

    console.log("Session : ",session);
    console.log("Session expires in : ",ttl);

    const serverInfo = await redis.info("server");

    console.log(
    "Node connected to:",
    serverInfo.split("\n").find((line) => line.startsWith("run_id:"))
    );

    await redis.quit();
}

main().catch((error) =>{
    console.error("Redis error:", error);
  process.exit(1);
});
