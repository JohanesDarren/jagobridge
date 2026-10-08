# Architecture notes

See `README.md` for setup. This file records the decisions that are easy to get wrong.

## Two surfaces, one codebase

- **Management API** `/api/v1/*` — cookie session auth, standard JSON envelope
  (`{ status, message, data }` / `{ status: "error", error_code, errors }`).
- **AI gateway** `/v1/*` — `Authorization: Bearer jb_...` API keys, OpenAI-compatible request and
  response bodies, OpenAI error shape with `error.code`.

They share the same Express app, database, and Redis but have separate middleware chains.

## Single gateway pipeline

`backend/src/gateway/pipeline.ts` owns every access, feature, and limit check. Both the gateway
and (later) the playground call it. No route re-implements these checks. Order:

1. API key check (middleware)
2. User active check
3. Model resolution (`public_name` → row)
4. Model access (user override → profile → default deny)
5. Feature entitlement and model capability
6. RPM and concurrency (Redis)
7. Usage admission (rolling 5-hour and weekly windows)
8. Forward to 9router (`stream_options.include_usage = true` when streaming)
9. Record usage with the model's multiplier snapshotted

## Access precedence

```
inactive user / deleted / disabled / unavailable model  -> DENY
user override                                            -> that effect
profile allow_all_models                                 -> ALLOW
profile model list                                       -> ALLOW
otherwise                                                -> DENY
```

Feature entitlements use the same precedence. Feature detection rules are in `pipeline.ts`
(`streaming`, `tool_calling`, `json_mode`, `vision_input`).

## Rolling windows and reset time

Usage is measured in weighted tokens: `ROUND((prompt + completion) × token_multiplier)`, with the
multiplier snapshotted per event. Admission blocks when either window is at or above its limit; an
admitted request runs to completion. `Retry-After` comes from walking the window's events oldest
first until usage drops below the limit (`usage.service.ts`).

## Caching and invalidation

Effective access is cached in Redis under `access:user:<id>` with a 60-second TTL, which bounds
how long a stale rule can live. Profile edits, model edits, feature toggles, user edits, and
syncs invalidate the affected keys (or all keys) immediately.

## Security

- Passwords: bcrypt cost 12.
- Refresh tokens: opaque, stored as SHA-256 hashes, rotated on every refresh; reuse revokes every
  session for that user and writes an audit entry.
- API keys: `jb_` + 40 chars, stored as SHA-256 hash plus an 8-character display prefix, shown
  once.
- Upstream key: read only in `gateway/upstream-client.ts`; never logged, templated, or returned.
- `httpOnly`, `Secure`, `SameSite=Strict` cookies; never `localStorage`.
