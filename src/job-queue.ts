import { randomUUID } from "node:crypto";
import type Redis from "ioredis";

export type JobStatus = "waiting" | "active" | "completed" | "failed";

export type JobPayload = Record<string, unknown>;

export type Job = {
  id: string;
  name: string;
  payload: JobPayload;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  error: string | null;
};

type AddJobOptions = {
  maxAttempts?: number;
};

export class JobQueue {
  private readonly waitingKey: string;
  private readonly activeKey: string;
  private readonly failedKey: string;
  private readonly jobKeyPrefix: string;

  constructor(
    private readonly redis: Redis,
    queueName: string
  ) {
    this.waitingKey = `queue:${queueName}:waiting`;
    this.activeKey = `queue:${queueName}:active`;
    this.failedKey = `queue:${queueName}:failed`;
    this.jobKeyPrefix = `queue:${queueName}:job:`;
  }

  async add(
    name: string,
    payload: JobPayload,
    options: AddJobOptions = {}
  ): Promise<Job> {
    const maxAttempts = options.maxAttempts ?? 3;

    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
      throw new Error("maxAttempts must be a positive whole number");
    }

    const job: Job = {
      id: randomUUID(),
      name,
      payload,
      status: "waiting",
      attempts: 0,
      maxAttempts,
      createdAt: new Date().toISOString(),
      error: null,
    };

    const transaction = this.redis.multi();

    transaction.hset(this.jobKey(job.id), {
      id: job.id,
      name: job.name,
      payload: JSON.stringify(job.payload),
      status: job.status,
      attempts: String(job.attempts),
      maxAttempts: String(job.maxAttempts),
      createdAt: job.createdAt,
      error: "",
    });

    transaction.rpush(this.waitingKey, job.id);

    await transaction.exec();

    return job;
  }

  async get(jobId: string): Promise<Job | null> {
    const storedJob = await this.redis.hgetall(this.jobKey(jobId));

    if (Object.keys(storedJob).length === 0) {
      return null;
    }

    return {
      id: storedJob.id,
      name: storedJob.name,
      payload: JSON.parse(storedJob.payload) as JobPayload,
      status: storedJob.status as JobStatus,
      attempts: Number(storedJob.attempts),
      maxAttempts: Number(storedJob.maxAttempts),
      createdAt: storedJob.createdAt,
      error: storedJob.error || null,
    };
  }

  async waitingCount(): Promise<number> {
    return this.redis.llen(this.waitingKey);
  }

  async claimNext(): Promise<Job | null> {
  const jobId = (await this.redis.lmove(
    this.waitingKey,
    this.activeKey,
    "LEFT",
    "RIGHT"
  )) as string | null;

  if (jobId === null) {
    return null;
  }

  const job = await this.get(jobId);

  if (job === null) {
    await this.redis.lrem(this.activeKey, 0, jobId);

    throw new Error(`Job ${jobId} was in the queue but could not be found`);
  }

  const attempts = job.attempts + 1;

  await this.redis.hset(this.jobKey(jobId), {
    status: "active",
    attempts: String(attempts),
    error: "",
  });

  return {
    ...job,
    status: "active",
    attempts,
    error: null,
  };
}

async complete(jobId: string): Promise<void> {
  const transaction = this.redis.multi();

  transaction.hset(this.jobKey(jobId), {
    status: "completed",
    error: "",
  });

  transaction.lrem(this.activeKey, 0, jobId);

  await transaction.exec();
}
async fail(jobId: string, errorMessage: string): Promise<Job> {
  const job = await this.get(jobId);

  if (job === null) {
    throw new Error(`Job ${jobId} could not be found`);
  }

  const shouldRetry = job.attempts < job.maxAttempts;
  const nextStatus: JobStatus = shouldRetry ? "waiting" : "failed";

  const transaction = this.redis.multi();

  transaction.hset(this.jobKey(jobId), {
    status: nextStatus,
    error: errorMessage,
  });

  transaction.lrem(this.activeKey, 0, jobId);

  if (shouldRetry) {
    transaction.rpush(this.waitingKey, jobId);
  } else {
    transaction.rpush(this.failedKey, jobId);
  }

  await transaction.exec();

  return {
    ...job,
    status: nextStatus,
    error: errorMessage,
  };
}

async failedCount(): Promise<number> {
  return this.redis.llen(this.failedKey);
}

  private jobKey(jobId: string): string {
    return `${this.jobKeyPrefix}${jobId}`;
  }
}