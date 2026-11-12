import Fastify, { type FastifyRequest } from "fastify";
import { redis } from "./redis-client";
import { SessionStore } from "./session-store";
import { RateLimiter } from "./rate-limiter";
import { NotificationService } from "./notification-service";
import { LeaderboardStore } from "./leaderboard-store";
import websocket from "@fastify/websocket";

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
const weeklyLeaderboard = new LeaderboardStore(redis, "weekly");

const notificationService = new NotificationService(redis);

notificationService.onNotification((notification) => {
  app.log.info({ notification }, "Live notification received");
});

app.addHook("onClose", async () => {
  await notificationService.stop();
});

function registerNotificationWebSocketRoute(): void {
  app.get("/ws/notifications", { websocket: true }, (socket) => {
    app.log.info("WebSocket client connected");

    const unsubscribe = notificationService.onNotification((notification) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(notification));
      }
    });

    socket.send(
      JSON.stringify({
        type: "notifications.connected",
        message: "You are connected to live Redis notifications.",
        connectedAt: new Date().toISOString(),
      })
    );

    socket.on("close", () => {
      unsubscribe();
      app.log.info("WebSocket client disconnected");
    });

    socket.on("error", (error) => {
      app.log.warn({ error }, "WebSocket client error");
    });
  });
}

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

  type ScoreBody = {
    score: number;
  };

  type LeaderboardPlayerParams = {
    playerId: string;
  };

  app.post<{
    Params: LeaderboardPlayerParams;
    Body: ScoreBody;
  }>("/leaderboard/players/:playerId/score", async (request, reply) => {
    const { score } = request.body;
    const { playerId } = request.params;

    if (!Number.isFinite(score)) {
      return reply.code(400).send({
        error: "score must be a valid number",
      });
    }

    await weeklyLeaderboard.setScore(playerId, score);

    const player = await weeklyLeaderboard.getPlayerRank(playerId);

          if (player === null) {
        return reply.code(500).send({
          error: "Score was saved but the player rank could not be found",
        });
      }

      const notification = await notificationService.publish({
        type: "leaderboard.score-updated",
        title: "Leaderboard updated",
        message: `${player.playerId} reached rank ${player.rank} with ${player.score} points.`,
        data: {
          playerId: player.playerId,
          score: player.score,
          rank: player.rank,
        },
      });
    return {
      message: "Score saved",
      leaderboard: "weekly",
      player,
      notification
    };
  });

    type TopPlayersQuery = {
      limit?: string;
    };
    app.get<{
    Params: LeaderboardPlayerParams;
  }>("/leaderboard/players/:playerId/rank", async (request, reply) => {
    const player = await weeklyLeaderboard.getPlayerRank(
      request.params.playerId
    );

    if (player === null) {
      return reply.code(404).send({
        error: "Player is not on this leaderboard",
      });
    }

    return {
      leaderboard: "weekly",
      player,
    };
});
  app.get<{
    Querystring: TopPlayersQuery;
  }>("/leaderboard/top", async (request, reply) => {
    const limit = Number(request.query.limit ?? 5);

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return reply.code(400).send({
        error: "limit must be a whole number between 1 and 100",
      });
    }

    const players = await weeklyLeaderboard.getTopPlayers(limit);

    return {
      leaderboard: "weekly",
      players,
    };
});

type NearbyPlayersQuery = {
  radius?: string;
};

app.get<{
  Params: LeaderboardPlayerParams;
  Querystring: NearbyPlayersQuery;
}>("/leaderboard/players/:playerId/nearby", async (request, reply) => {
  const radius = Number(request.query.radius ?? 1);

  if (!Number.isInteger(radius) || radius < 0 || radius > 10) {
    return reply.code(400).send({
      error: "radius must be a whole number between 0 and 10",
    });
  }

  const players = await weeklyLeaderboard.getPlayersNear(
    request.params.playerId,
    radius
  );

  if (players.length === 0) {
    return reply.code(404).send({
      error: "Player is not on this leaderboard",
    });
  }

  return {
    leaderboard: "weekly",
    centerPlayerId: request.params.playerId,
    radius,
    players,
  };
});

async function start(): Promise<void> {
  try {
    await app.register(websocket);
    registerNotificationWebSocketRoute();

    await notificationService.start();
    const port = Number(process.env.PORT ?? 3000);
    await app.listen({ port, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
