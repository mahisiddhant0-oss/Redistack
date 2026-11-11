# Redistack

A hands-on TypeScript project for learning Redis one feature at a time.

## What this project uses

- TypeScript for the application code
- Redis as the data store
- Docker Compose to run Redis locally
- `ioredis` for the TypeScript-to-Redis connection

## Start Redis locally

1. Open Docker Desktop and wait until it is running.
2. From this project folder, run:

   ```bash
   docker compose up -d
   ```

3. Check that the Redis container is running:

   ```bash
   docker compose ps
   ```

Redis is available at `127.0.0.1:6380`.

To stop Redis later:

```bash
docker compose down
```

## Run the API and examples

```bash
npm run dev
npm run demo:cache
npm run demo:sessions
npm run demo:rate-limit-naive
npm run demo:rate-limit-fixed
npm run demo:leaderboard
```

The local API runs on `http://127.0.0.1:3000`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Confirms that the API can communicate with Redis. |
| `POST` | `/login` | Creates a TTL-based Redis session. |
| `GET` | `/me` | Retrieves the authenticated session using `x-session-id`. |
| `POST` | `/logout` | Deletes one session. |
| `POST` | `/users/:userId/logout-all` | Revokes every active session for a user. |
| `POST` | `/leaderboard/players/:playerId/score` | Creates or updates a player's score. |
| `GET` | `/leaderboard/top?limit=5` | Returns the highest-scoring players. |
| `GET` | `/leaderboard/players/:playerId/rank` | Returns one player's score and rank. |
| `GET` | `/leaderboard/players/:playerId/nearby?radius=1` | Returns players near a chosen player's rank. |

## Learning progress

### Stage 1: Redis basics and local setup

Completed:

- Redis runs locally with Docker Compose.
- TypeScript connects using `ioredis`.
- Examples use strings, hashes, and TTLs.

### Stage 2: Caching layer

Completed:

- `CacheStore` provides cache-aside reads using `getOrSet`.
- Cached values are JSON encoded and have a TTL.
- The cache demo shows a cache miss followed by a faster cache hit.

### Stage 3: Session management

Completed learning implementation:

- `session:<sessionId>` stores one user's session details as a Redis hash.
- Each session has an expiry time (TTL).
- `user-sessions:<userId>` is a Redis Set containing every active session ID for one user.
- A normal logout removes one session.
- Revoke-all removes every session belonging to one user.
- Fastify exposes login, profile, logout, and revoke-all endpoints for testing in RequestKit.

Session data looks like this:

```text
session:<session-id>
  userId: "1"
  email: "aarav@example.com"
  role: "learner"

user-sessions:1
  <laptop-session-id>
  <phone-session-id>
```

### Stage 4: Rate limiting

Completed learning implementation:

- Per-IP and per-user limits protect the authenticated `/me` route.
- Redis counters use `INCR` and a fixed time window.
- A Lua script runs the increment and TTL setup atomically.
- The API returns `429 Too Many Requests` with a retry-after value when a limit is exceeded.
- A naïve implementation revealed a bug: resetting the TTL on every request created an unfair moving window.
- The fix sets the TTL only on the first request in the window, so the timer counts down normally.

### Stage 5: Leaderboards

Completed learning implementation:

- `leaderboard:weekly` is a Redis sorted set where each player ID is a member
  and their score determines the order.
- Scores can be created or updated through the Fastify API.
- The project retrieves top players, an individual player's rank, and players
  near a chosen rank.
- Redis commands such as `ZADD`, `ZREVRANGE`, `ZREVRANK`, and `ZSCORE` do the
  ranking work without sorting data in TypeScript.
- The leaderboard demo and RequestKit checks verify that a score update moves a
  player to the correct rank immediately.

## Next steps

1. Begin Stage 6: use Redis Pub/Sub and WebSockets for real-time notifications.
2. Add automated tests and improve validation before production work.
3. Build the final Redis visualizer UI after the backend stages are complete.
