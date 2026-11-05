import { redis } from "./redis-client";
import { SessionStore } from "./session-store";

async function main() {
  const sessionStore = new SessionStore(redis);
  const userId = "1";

  const laptopSessionId = await sessionStore.create(
    userId,
    "aarav@example.com",
    "learner"
  );

  const phoneSessionId = await sessionStore.create(
    userId,
    "aarav@example.com",
    "learner"
  );

  console.log("Laptop session ID:", laptopSessionId);
  console.log("Phone session ID:", phoneSessionId);

  const activeSessionsBeforeLogout = await redis.smembers(
    `user-sessions:${userId}`
  );
  console.log("Active sessions after login:", activeSessionsBeforeLogout);

  const loggedOut = await sessionStore.destroy(laptopSessionId);
  console.log("Laptop logged out:", loggedOut);

  const activeSessionsAfterLogout = await redis.smembers(
    `user-sessions:${userId}`
  );
  console.log("Active sessions after laptop logout:", activeSessionsAfterLogout);

  const revokedCount = await sessionStore.revokeAllForUser(userId);
  console.log("Sessions revoked everywhere:", revokedCount);

  const phoneSessionAfterRevoke = await sessionStore.get(phoneSessionId);
  console.log("Phone session after revoke-all:", phoneSessionAfterRevoke);

  const activeSessionsAfterRevoke = await redis.smembers(
    `user-sessions:${userId}`
  );
  console.log("Active sessions after revoke-all:", activeSessionsAfterRevoke);

  await redis.quit();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
