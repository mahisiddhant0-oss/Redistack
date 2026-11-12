import { redis } from "./redis-client";

const CHANNEL = "notifications:events";

type LiveNotification = {
  type: string;
  playerId: string;
  score: number;
  createdAt: string;
};

async function main(): Promise<void> {
  const subscriber = redis.duplicate();

  const messageReceived = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out while waiting for the notification"));
    }, 2000);

    subscriber.once("message", (channel, rawMessage) => {
      clearTimeout(timeout);

      const notification = JSON.parse(rawMessage) as LiveNotification;

      console.log("\n🔔 Live notification received");
      console.log("Channel:", channel);
      console.log(notification);

      resolve();
    });
  });

  try {
    await subscriber.subscribe(CHANNEL);

    console.log(`Listening on Redis channel: ${CHANNEL}`);

    const notification: LiveNotification = {
      type: "leaderboard.score-updated",
      playerId: "riya",
      score: 1100,
      createdAt: new Date().toISOString(),
    };

    console.log("\n📤 Publishing a leaderboard event...");

    await redis.publish(CHANNEL, JSON.stringify(notification));

    await messageReceived;
  } finally {
    await subscriber.unsubscribe(CHANNEL);
    await subscriber.quit();
    await redis.quit();
  }
}

main().catch((error: unknown) => {
  console.error("Notification demo failed:", error);
  process.exitCode = 1;
});