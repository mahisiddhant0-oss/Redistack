import type Redis from "ioredis";

export type LeaderboardEntry = {
  playerId: string;
  score: number;
  rank: number;
};

export class LeaderboardStore {
  private readonly key: string;

  constructor(
    private readonly redis: Redis,
    leaderboardName: string
  ) {
    this.key = `leaderboard:${leaderboardName}`;
  }

  async setScore(playerId: string, score: number): Promise<void> {
    await this.redis.zadd(this.key, score, playerId);
  }

  async getTopPlayers(limit: number): Promise<LeaderboardEntry[]> {
    const values = await this.redis.zrevrange(
      this.key,
      0,
      limit - 1,
      "WITHSCORES"
    );

    return this.toEntries(values, 0);
  }

  async getPlayerRank(playerId: string): Promise<LeaderboardEntry | null> {
    const [rank, score] = await Promise.all([
      this.redis.zrevrank(this.key, playerId),
      this.redis.zscore(this.key, playerId),
    ]);

    if (rank === null || score === null) {
      return null;
    }

    return {
      playerId,
      score: Number(score),
      rank: rank + 1,
    };
  }

  async getPlayersNear(
    playerId: string,
    radius: number
  ): Promise<LeaderboardEntry[]> {
    const playerRank = await this.redis.zrevrank(this.key, playerId);

    if (playerRank === null) {
      return [];
    }

    const start = Math.max(playerRank - radius, 0);
    const end = playerRank + radius;

    const values = await this.redis.zrevrange(
      this.key,
      start,
      end,
      "WITHSCORES"
    );

    return this.toEntries(values, start);
  }

  private toEntries(
    values: string[],
    startingRankIndex: number
  ): LeaderboardEntry[] {
    const entries: LeaderboardEntry[] = [];

    for (let index = 0; index < values.length; index += 2) {
      entries.push({
        playerId: values[index],
        score: Number(values[index + 1]),
        rank: startingRankIndex + index / 2 + 1,
      });
    }

    return entries;
  }
}