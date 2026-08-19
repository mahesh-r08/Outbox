# ReachInbox Email Scheduler

A production-grade, distributed email scheduling platform built for Outbox Labs. Supports high-throughput cold outreach campaigns with per-sender rate limiting, crash-resistant job queues, and multi-tenant isolation.

---

## Overview

ReachInbox lets authenticated users:

1. Sign in via **Google OAuth 2.0**
2. Create **Sender Mailboxes** (Ethereal SMTP, auto-provisioned or manual)
3. Compose an **Email Campaign** — upload CSV/TXT leads, set subject, body, start time, delay, and hourly limits
4. Monitor **Scheduled** and **Sent** emails in real time through a polished dashboard

The scheduling infrastructure is designed to be safe under:
- Multiple concurrent workers
- Worker crashes and restarts
- API restarts
- Redis reconnects
- Duplicate BullMQ job delivery
- Thousands of scheduled emails per campaign
- Hourly rate-limit exhaustion

---

## Features

| Feature | Implementation |
|---|---|
| Authentication | Google OAuth 2.0 via Passport.js + Redis-backed sessions |
| Multi-tenancy | Every DB query scoped by `userId` from session |
| Scheduling | BullMQ delayed jobs (no cron, no setInterval) |
| Idempotency | Atomic PostgreSQL claim lock (`scheduled → processing → sent`) |
| Rate limiting | Redis Lua atomic counter per sender per hour window |
| Minimum delay | Redis-backed distributed slot coordination across workers |
| Rescheduling | Rate-limit exhausted jobs automatically defer to next window |
| SMTP | Nodemailer + Ethereal (pooled, abstracted via `EmailProvider` interface) |
| Credential security | SMTP passwords encrypted at rest with AES-256-GCM |
| Observability | Structured Pino logging; recipients masked in logs |
| Graceful shutdown | SIGTERM/SIGINT handled on both API and Worker processes |
| Health checks | `/health` (liveness) and `/ready` (readiness with DB + Redis check) |
| API security | Helmet, strict CORS, HTTP-only cookies, rate limiting |

---

## Architecture

```
React (Vite + TypeScript + Tailwind)
         │ HTTP/HTTPS (credentials: true)
         ▼
Express API (port 4000)
  ├── Google OAuth → session
  ├── /api/senders     (CRUD, SMTP verification)
  ├── /api/emails      (schedule, list, cancel, metrics)
  ├── /health          (liveness probe)
  └── /ready           (readiness probe)
         │
    ┌────┴──────┐
    ▼           ▼
PostgreSQL    Redis
(Prisma)    (ioredis)
    │           │
    └─────┬─────┘
          ▼
     BullMQ Queue (email-send)
          │
     Worker Process (independently deployable)
          │  concurrency=5, lock=30s, stall recovery
          ▼
     Email State Machine
       scheduled → processing → sent
                             → failed (after 3 retries)
                             → rescheduled (rate limit)
          │
     Nodemailer / Ethereal SMTP
```

---

## Authentication

The only login method is **Google OAuth 2.0**.

There is no demo login, mock authentication, dev bypass, or fake user system.

```
GET  /api/auth/google           → Redirect to Google consent screen
GET  /api/auth/google/callback  → OAuth callback; find or create user; set session
GET  /api/auth/me               → Returns current authenticated user (requires session)
POST /api/auth/logout           → Destroys session; clears cookie
```

Sessions are stored in Redis via `connect-redis`. Cookies are HTTP-only with `SameSite=lax` (development) or `SameSite=none; Secure` (production).

---

## Database

PostgreSQL managed via Prisma ORM.

### Schema

| Model | Key Fields |
|---|---|
| `User` | `id`, `googleId`, `email`, `name`, `avatarUrl` |
| `Sender` | `userId`, `email`, `smtpHost`, `smtpPort`, `smtpUser`, `smtpPassword` (encrypted), `hourlyLimit` |
| `EmailCampaign` | `userId`, `senderId`, `subject`, `body`, `startTime`, `delayMs`, `hourlyLimit`, `status` |
| `ScheduledEmail` | `campaignId`, `senderId`, `recipient`, `subject`, `body`, `scheduledAt`, `status`, `bullJobId`, `messageId`, `previewUrl` |

All user-owned records cascade-delete when their parent `User` is deleted.

### Indexes

```
User.email, User.googleId
Campaign.userId, Campaign.status
ScheduledEmail.status, scheduledAt, senderId+status, campaignId, recipient
```

---

## BullMQ Queue Design

Each `ScheduledEmail` maps to exactly one BullMQ delayed job:

```
jobId = scheduledEmailId  ← deterministic, prevents duplicate enqueue
delay = scheduledAt - now
```

Jobs are configured with:
```ts
attempts: 3
backoff: { type: 'exponential', delay: 5000 }
removeOnComplete: false   // retained for audit
removeOnFail: false
```

Stall recovery is configured with `lockDuration: 30s` and `maxStalledCount: 2`.

---

## Worker Architecture

The worker process runs independently from the API:

```bash
npm run worker           # start worker
WORKER_CONCURRENCY=5     # env-configurable concurrency
```

Multiple worker instances can run simultaneously — they safely share BullMQ, Redis, and PostgreSQL state. No in-memory global state.

---

## Idempotency

The state machine ensures at-most-once email delivery after a successful atomic claim:

```
1. Atomic PostgreSQL updateMany:
   WHERE status IN ('scheduled', 'queued', 'rescheduled')
   SET status = 'processing'

2. If count = 0:
   - Already 'sent' → log and skip (idempotency guard)
   - Already 'cancelled' → skip
   - Already 'processing' (another worker won) → skip

3. SMTP send

4. Update status = 'sent', sentAt, messageId, previewUrl
```

**Known limitation:** If the process crashes between step 3 (SMTP accepted) and step 4 (DB update), a stalled job will be retried and the email may be sent twice. SMTP does not provide a universal exactly-once delivery primitive. The architecture minimizes this window to microseconds for practical purposes.

---

## Distributed Rate Limiting

### Hourly Limit

Redis key: `email-rate:{senderId}:{hourWindowIndex}`

An atomic Lua script atomically checks and increments the counter:

```lua
local current = redis.call('GET', KEYS[1])
if current and tonumber(current) >= tonumber(ARGV[1]) then
  return {0, tonumber(current)}   -- rejected
end
local val = redis.call('INCR', KEYS[1])
if val == 1 then redis.call('EXPIRE', KEYS[1], 7200) end
return {1, val}                   -- allowed
```

If the limit is reached, the worker:
1. Reverts the DB status to `rescheduled`
2. Removes the current BullMQ job
3. Re-enqueues with a delay until the next hour window starts

Example with limit = 3:
```
Hour 1: emails A, B, C sent
Hour 2: emails D, E, F automatically rescheduled and sent
```

### Minimum Delay Coordination

Redis key: `email-last-send:{senderId}`

An atomic Lua script reserves the next send slot across all workers:

```lua
local lastSend = tonumber(redis.call('GET', key) or 0)
local diff = now - lastSend
if diff < minDelay then
  return minDelay - diff   -- caller must wait
else
  redis.call('SET', key, now, 'PX', 86400000)
  return 0                 -- cleared to send immediately
end
```

This ensures 5 concurrent workers cannot all fire simultaneously — each waits its turn.

---

## Retry Strategy

| Error Type | Behavior |
|---|---|
| Transient SMTP failure | BullMQ exponential backoff retry (up to 3 attempts) |
| Permanent failure (bad credentials, invalid recipient) | Status set to `failed` with `lastError` on final attempt |
| Rate limit exhausted | Rescheduled to next hour window (not failed) |
| Worker crash (stalled job) | BullMQ stall recovery re-queues the job; DB idempotency guard prevents duplicate send |

---

## Crash Recovery

If a worker crashes while processing a job:
1. BullMQ detects the stalled job after `lockDuration` (30s) via `stalledInterval` (15s) polling
2. The job is re-queued for retry (up to `maxStalledCount = 2` times)
3. When a new worker picks up the job, the atomic DB claim check prevents duplicate sending if the previous worker already completed SMTP

---

## Security

- **No SMTP passwords in API responses** — `smtpPassword` is excluded from all `select` clauses
- **SMTP passwords encrypted at rest** — AES-256-GCM with application-level `ENCRYPTION_KEY`
- **No wildcard CORS** — origin whitelist enforced server-side
- **HTTP-only cookies** — session IDs are never accessible to JavaScript
- **Helmet** — strict HTTP security headers
- **Rate limiting** — auth routes: 30 req/15min; API routes: 120 req/min
- **No secrets in logs** — SMTP passwords, OAuth tokens, and session secrets are never logged
- **Recipient masking** — email addresses in logs are masked (e.g., `j***e@example.com`)
- **Multi-tenant isolation** — every DB query requires `userId` from session; no frontend-supplied user IDs trusted

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `SESSION_SECRET` | ✅ | Min 32 chars. Keep secret. |
| `ENCRYPTION_KEY` | ✅ | AES-256-GCM key for SMTP password encryption |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | ✅ | OAuth redirect URI |
| `FRONTEND_URL` | ✅ | Frontend origin for CORS |
| `NODE_ENV` | ✅ | `development` \| `production` \| `test` |
| `PORT` | ➖ | API port (default: 4000) |
| `COOKIE_SECURE` | ➖ | Set `true` in production (HTTPS required) |
| `WORKER_CONCURRENCY` | ➖ | Concurrent jobs per worker (default: 5) |
| `MIN_EMAIL_DELAY_MS` | ➖ | Minimum ms between sends (default: 2000) |
| `MAX_EMAILS_PER_HOUR` | ➖ | Hourly sender limit (default: 200) |
| `ETHEREAL_HOST/PORT/USER/PASSWORD` | ➖ | Auto-provisioned if empty |

---

## Local Development

### Prerequisites
- Node.js 22+
- Docker Desktop

### 1. Clone and install

```bash
git clone <repo>
cd reachinbox
cp .env.example .env
# Edit .env — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET, ENCRYPTION_KEY
npm install
```

### 2. Start infrastructure

```bash
docker compose up -d
```

### 3. Apply database schema

```bash
cd backend
npm run db:generate
npm run db:migrate
```

### 4. Start API server

```bash
cd backend
npm run dev
```

### 5. Start worker process

```bash
cd backend
npm run worker
```

### 6. Start frontend

```bash
cd frontend
npm run dev
```

Visit `http://localhost:5173`. Sign in with Google.

---

## Docker (Full Stack)

Uncomment the `api`, `worker`, and `frontend` services in `docker-compose.yml` to run the full containerized stack:

```bash
docker compose up -d
```

---

## Testing

```bash
cd backend
npm run test
```

Tests cover:
- Atomic idempotency (duplicate job protection)
- Rate limiter Lua script logic
- CSV/email address parsing and deduplication
- Campaign scheduling validation

---

## API Documentation

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/auth/google` | Public | Redirect to Google OAuth |
| `GET` | `/api/auth/google/callback` | Public | OAuth callback |
| `GET` | `/api/auth/me` | ✅ | Current user profile |
| `POST` | `/api/auth/logout` | ✅ | Destroy session |

### Senders

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/senders` | ✅ | List your sender mailboxes |
| `POST` | `/api/senders` | ✅ | Create sender (auto-provisions Ethereal if no credentials) |
| `DELETE` | `/api/senders/:id` | ✅ | Delete sender |

### Emails

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/emails/schedule` | ✅ | Create campaign and schedule emails |
| `GET` | `/api/emails/scheduled` | ✅ | List scheduled emails (paginated) |
| `GET` | `/api/emails/sent` | ✅ | List sent/failed emails (paginated) |
| `GET` | `/api/emails/:id` | ✅ | Get single email detail |
| `DELETE` | `/api/emails/:id/cancel` | ✅ | Cancel a scheduled email |
| `GET` | `/api/emails/metrics` | ✅ | Dashboard metrics summary |

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe — always 200 if process is running |
| `GET` | `/ready` | Readiness probe — 200 if DB+Redis up; 503 otherwise |

---

## Production Deployment Considerations

1. **Set `NODE_ENV=production`** — enables secure cookies, production logging, no stack traces in error responses
2. **Use HTTPS** and set `COOKIE_SECURE=true` with `SameSite=none`
3. **Run multiple worker replicas** behind a shared Redis/PostgreSQL for horizontal scaling
4. **Configure a connection pooler** (e.g., PgBouncer) in front of PostgreSQL for high concurrency
5. **Monitor `/ready`** from your orchestrator (Kubernetes, ECS) for rolling deployments
6. **Rotate `ENCRYPTION_KEY`** with a key rotation migration strategy before any existing encrypted passwords become unreadable

---

## Trade-offs & Known Limitations

| Area | Trade-off |
|---|---|
| SMTP idempotency | At-most-once after claim. A crash between SMTP accept and DB update can cause a rare duplicate. SMTP has no transaction API. |
| Outbox pattern | Not implemented — if the API crashes after DB commit but before BullMQ enqueue, the job is lost. Workaround: re-enqueue on startup by querying `status = 'scheduled' AND bullJobId IS NULL`. |
| Rate limit coordination | Per-hour window resets at calendar hour boundaries. A burst at the end of one window + start of next can briefly exceed 2× the hourly limit across window seam. |
| Session store failover | If Redis is unavailable, sessions fall back to in-memory store and are lost on restart. |
| Minimum delay | `await sleep(waitMs)` in the worker holds the concurrency slot during the wait, reducing effective throughput. |

---

## License

MIT — Built as a technical assignment for Outbox Labs.
