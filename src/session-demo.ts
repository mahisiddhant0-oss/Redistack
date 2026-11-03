import { redis } from "./redis-client";
import { SessionStore } from "./session-store";

async function main() {
  const sessionStore = new SessionStore(redis);

  const sessionId = await sessionStore.create(
    "1",
    "aarav@example.com",
    "learner"
  );

  console.log("Created session ID:", sessionId);

  const session = await sessionStore.get(sessionId);
  console.log("Retrieved session:", session);

  const refreshed = await sessionStore.refresh(sessionId, 600);
  console.log("Session refreshed:", refreshed);

  const deleted = await sessionStore.destroy(sessionId);
  console.log("Session deleted:", deleted);

  const missingSession = await sessionStore.get(sessionId);
  console.log("Session after logout:", missingSession);

  await redis.quit();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});