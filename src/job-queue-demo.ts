import { redis } from "./redis-client";
import { JobQueue } from "./job-queue";

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function main(): Promise<void> {
  const queue = new JobQueue(redis, "achievement-emails");

  try {
    console.log("🔎 Worker is looking for a waiting job...");

    const job = await queue.claimNext();

    if (job === null) {
      console.log("There are no waiting jobs to process.");
      return;
    }

    console.log("\n⚙️ Worker claimed this job:");
    console.log(job);

    console.log(`\n📧 Simulating work for: ${job.name}`);
    await wait(1000);

    await queue.complete(job.id);

    const completedJob = await queue.get(job.id);

    console.log("\n✅ Job completed:");
    console.log(completedJob);

    const waitingJobs = await queue.waitingCount();
    console.log(`\n⏳ Jobs still waiting: ${waitingJobs}`);
  } finally {
    await redis.quit();
  }
}

main().catch((error: unknown) => {
  console.error("Job worker demo failed:", error);
  process.exitCode = 1;
});