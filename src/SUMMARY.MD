# Redistack — Project Handoff Summary

## Project purpose

Redistack is a TypeScript learning project focused on building practical backend features with Redis. The aim is to create a strong portfolio project that shows not only Redis commands, but also why specific Redis data structures are useful for real backend problems.

The project uses:

- TypeScript
- Node.js
- Redis
- ioredis
- Docker Compose

## What has been completed

### Stage 1 — Redis basics and local setup

Redis is configured to run locally through Docker Compose on port `6380`.

The project has a shared Redis client in `src/redis-client.ts`. Basic Redis concepts have been explored through examples:

- Strings
- Hashes
- TTLs / expiry
- Redis connection handling

### Stage 2 — Caching layer

A reusable `CacheStore` class has been created in `src/cache-store.ts`.

It uses the cache-aside pattern:

1. Try to get a value from Redis.
2. If Redis has the value, return it as a cache hit.
3. If Redis does not have it, fetch the original value.
4. Save that value in Redis with a TTL.
5. Return the fresh value.

A cache demo in `src/cache-demo.ts` simulates a slow database request and shows the difference between the first cache miss and the faster second cache hit.

### Stage 3 — Session management

The core Redis session logic is implemented in `src/session-store.ts`.

Each user session is stored as a Redis hash:

```text
session:<session-id>
  userId
  email
  role
```

Each session receives a TTL, so it automatically expires.

The project also tracks all active sessions for a user with a Redis Set:

```text
user-sessions:<user-id>
  laptop-session-id
  phone-session-id
```

Current session features:

- Create a unique UUID-based session
- Retrieve a session
- Refresh session expiry
- Log out one device
- Track multiple devices per user
- Revoke every session for one user

The revoke-all flow uses a Redis pipeline to efficiently delete all session records for a user.

Fastify exposes the learning API through these routes:

```text
GET  /health
POST /login
GET  /me
POST /logout
POST /users/:userId/logout-all
```

### Stage 4 — Rate limiting

The authenticated `/me` route now has both per-IP and per-user limits.

The limiter uses Redis counters with a fixed time window. A Lua script executes
the counter increment, first-request expiry setup, and TTL lookup atomically.
This returns an allow/deny decision, the remaining request count, and the time
until a blocked caller can retry.

During development, a naïve limiter called `EXPIRE` on every request. That
reset the TTL each time and created an unfair moving window for active users.
The corrected script calls `EXPIRE` only when the counter equals one. The timer
therefore counts down normally, and the API responds with `429 Too Many
Requests` when the user or IP exceeds its limit.

### Stage 5 — Leaderboards

The project now uses a Redis sorted set called `leaderboard:weekly` for player
scores and rankings. `LeaderboardStore` stores player IDs as members and their
numeric scores as sorted-set scores.

Current leaderboard features:

- Create or update a player's score
- Retrieve the highest-scoring players
- Retrieve one player's score and rank
- Retrieve players near a selected rank

Fastify exposes these routes:

```text
POST /leaderboard/players/:playerId/score
GET  /leaderboard/top?limit=5
GET  /leaderboard/players/:playerId/rank
GET  /leaderboard/players/:playerId/nearby?radius=1
```

The terminal demo and RequestKit checks verified that setting Riya's score to
1100 immediately moved her to rank one. The nearby-player route correctly
returned the players above and below Maya's rank.

## Current status

Stages 1 through 5 are complete as learning implementations.

The project still needs:

- Automated tests
- Secure cookie or token handling
- Cleanup of stale session IDs after natural TTL expiry
- Production-ready validation and authorization

## Next work: Stage 6 — Real-time notifications

Use Redis Pub/Sub and WebSockets to deliver live events to connected clients.
Add tests for the existing cache, session, rate-limit, and leaderboard flows
before treating the project as production-ready.

## Future roadmap

### Stage 5 — Leaderboards (complete)

Redis sorted sets now provide:

- Player scores
- Global rankings
- Rank lookup
- Players near a specific rank

### Stage 6 — Real-time notifications

Use Redis Pub/Sub and WebSockets to send live events to connected users.

### Stage 7 — Background jobs

Build a job workflow with:

- Queues
- Retries
- Delayed jobs
- Idempotency
- Failed-job handling

### Stage 8 — Production readiness

Prepare the project for realistic use with:

- Automated tests
- Metrics and observability
- Docker improvements
- Load testing
- Failure handling
- Documentation
- Deployment

## How to explain the project

“Redistack is a TypeScript project where I learn Redis through practical backend patterns. I run Redis locally with Docker and connect it with ioredis. I built cache-aside reads with TTL-based expiry, multi-device sessions using Redis hashes and Sets, and a Fastify API to demonstrate those features. I also implemented per-IP and per-user rate limiting with atomic Lua scripts. During that work, I found that resetting a counter TTL on every request created an unfair moving window; I fixed it by setting expiry only on the first request in the window. I then built a sorted-set leaderboard with score updates, top-player lookups, individual ranks, and nearby-player queries. Next, I will build real-time notifications with Redis Pub/Sub and WebSockets, then strengthen the project with automated tests.”

## Definition of success

The project will be successful when it demonstrates a complete Redis-powered backend toolkit:

- Fast cached reads
- Secure, expiring multi-device sessions
- Atomic rate limits
- Leaderboards
- Live notifications
- Reliable background jobs
- Tests, metrics, documentation, and deployment

At that point, Redistack will be a complete practical showcase of Redis in a TypeScript backend.
