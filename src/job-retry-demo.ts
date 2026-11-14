import { redis } from "./redis-client";
import { JobQueue } from "./job-queue";

async function main(): Promise<void> {
  const queue = new JobQueue(redis, "retry-demo");

  try {
    const newJob = await queue.add(
      "send-achievement-email",
      {
        playerId: "maya",
        email: "maya@redistack.dev",
        rank: 2,
      },
      {
        maxAttempts: 2,
      }
    );

    console.log("📥 New job added:");
    console.log(newJob);

    const firstAttempt = await queue.claimNext();

    if (firstAttempt === null) {
      throw new Error("The worker could not claim the first attempt");
    }

    console.log("\n❌ First attempt failed:");
    console.log(firstAttempt);

    const jobForRetry = await queue.fail(
      firstAttempt.id,
      "Email provider is temporarily unavailable"
    );

    console.log("\n🔁 Job returned for retry:");
    console.log(jobForRetry);

    const secondAttempt = await queue.claimNext();

    if (secondAttempt === null) {
      throw new Error("The worker could not claim the retry attempt");
    }

    console.log("\n❌ Second attempt failed:");
    console.log(secondAttempt);

    const failedJob = await queue.fail(
      secondAttempt.id,
      "Email provider failed again after retry"
    );

    console.log("\n🚨 Job moved to failed queue:");
    console.log(failedJob);

    const failedJobs = await queue.failedCount();
    console.log(`\n📦 Jobs in failed queue: ${failedJobs}`);
  } finally {
    await redis.quit();
  }
}

main().catch((error: unknown) => {
  console.error("Job retry demo failed:", error);
  process.exitCode = 1;
});
