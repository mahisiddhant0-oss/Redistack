import { LeaderboardStore } from "./leaderboard-store";
import { redis } from "./redis-client";

async function main(): Promise<void> {
  const leaderboard = new LeaderboardStore(redis, "weekly");

  // Reset only this demo's leaderboard, so every run starts predictably.
  await redis.del("leaderboard:weekly");

  await leaderboard.setScore("aarav", 980);
  await leaderboard.setScore("maya", 820);
  await leaderboard.setScore("dev", 760);
  await leaderboard.setScore("riya", 640);
  await leaderboard.setScore("zoya", 510);

  console.log("\n🏆 Top 3 players");
  console.table(await leaderboard.getTopPlayers(3));

  console.log("\n🎯 Maya's rank");
  console.log(await leaderboard.getPlayerRank("maya"));

  console.log("\n👥 Players near Maya (radius: 1)");
  console.table(await leaderboard.getPlayersNear("maya", 1));
}

main()
  .catch((error: unknown) => {
    console.error("Leaderboard demo failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await redis.quit();
  });