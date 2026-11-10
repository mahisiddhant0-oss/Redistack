import Fastify, { type FastifyRequest } from "fastify";
import { redis } from "./redis-client";
import { SessionStore } from "./session-store";
import { RateLimiter } from "./rate-limiter";

type LoginBody = {
  userId: string;
  email: string;
  role: string;
  ttlSeconds?: number;
};

type RevokeAllParams = {
  userId: string;
};

const app = Fastify({ logger: true });
const sessionStore = new SessionStore(redis);

const rateLimiter = new RateLimiter(redis);

const IP_REQUEST_LIMIT = 10;
const USER_REQUEST_LIMIT = 3;
const RATE_LIMIT_WINDOW_SECONDS = 30;

function getSessionId(request: FastifyRequest): string | null {
  const sessionId = request.headers["x-session-id"];

  return typeof sessionId === "string" ? sessionId : null;
}

app.get("/health", async () => {
  const redisStatus = await redis.ping();

  return {
    status: "ok",
    redis: redisStatus,
  };
});

app.post<{ Body: LoginBody }>("/login", async (request, reply) => {
  const { userId, email, role, ttlSeconds = 300 } = request.body;

  if (!userId || !email || !role) {
    return reply.code(400).send({
      error: "userId, email, and role are required",
    });
  }

  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    return reply.code(400).send({
      error: "ttlSeconds must be a positive whole number",
    });
  }

  const sessionId = await sessionStore.create(userId, email, role, ttlSeconds);
  const session = await sessionStore.get(sessionId);

  return reply.code(201).send({
    message: "Session created",
    sessionId,
    expiresInSeconds: ttlSeconds,
    session,
  });
});

app.get("/me", async (request, reply) => {
  const sessionId = getSessionId(request);

  if (sessionId === null) {
    return reply.code(401).send({
      error: "Send a session ID in the x-session-id header",
    });
  }

  const session = await sessionStore.get(sessionId);

  if (session === null) {
    return reply.code(401).send({
      error: "Session is invalid or has expired",
    });
  }

  const ipRateLimit = await rateLimiter.check(
    `rate-limit:ip:${request.ip}`,
    IP_REQUEST_LIMIT,
    RATE_LIMIT_WINDOW_SECONDS
  );

  if (!ipRateLimit.allowed) {
    return reply.code(429).send({
      error: "Too many requests from this IP address",
      retryAfterSeconds: ipRateLimit.retryAfterSeconds,
    });
  }

  const userRateLimit = await rateLimiter.check(
    `rate-limit:user:${session.userId}`,
    USER_REQUEST_LIMIT,
    RATE_LIMIT_WINDOW_SECONDS
  );

  if (!userRateLimit.allowed) {
    return reply.code(429).send({
      error: "Too many requests for this user",
      retryAfterSeconds: userRateLimit.retryAfterSeconds,
    });
  }

  reply.header("X-RateLimit-Limit", userRateLimit.limit);
  reply.header("X-RateLimit-Remaining", userRateLimit.remaining);

  return {
    message: "Authenticated session",
    session,
    rateLimit: userRateLimit,
  };
});

app.post("/logout", async (request, reply) => {
  const sessionId = getSessionId(request);

  if (sessionId === null) {
    return reply.code(401).send({
      error: "Send a session ID in the x-session-id header",
    });
  }

  const loggedOut = await sessionStore.destroy(sessionId);

  if (!loggedOut) {
    return reply.code(404).send({
      error: "Session was not found or has already expired",
    });
  }

  return {
    message: "Session logged out",
  };
});

app.post<{ Params: RevokeAllParams }>(
  "/users/:userId/logout-all",
  async (request) => {
    const revokedSessions = await sessionStore.revokeAllForUser(
      request.params.userId
    );

    return {
      message: "All sessions revoked",
      userId: request.params.userId,
      revokedSessions,
    };
  }
);

async function start(): Promise<void> {
  try {
    const port = Number(process.env.PORT ?? 3000);
    await app.listen({ port, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
