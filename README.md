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

## Run the examples

```bash
npx tsx src/cache-demo.ts
npx tsx src/session-demo.ts
```

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

In progress:

- `session:<sessionId>` stores one user's session details as a Redis hash.
- Each session has an expiry time (TTL).
- `user-sessions:<userId>` is a Redis Set containing every active session ID for one user.
- A normal logout removes one session.
- Revoke-all removes every session belonging to one user.

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

## Next steps

1. Run and verify the session demo.
2. Add automated tests for session creation, logout, expiry, and revoke-all.
3. Build a small HTTP API with login, logout, and revoke-all endpoints.
4. Begin Stage 4: rate limiting.
