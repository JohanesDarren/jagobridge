# API reference (summary)

Full contracts, validation rules, and error codes are in the PRD (§6.4). This is a quick index of
what is implemented.

## Management API — `/api/v1`

| Method | Path | Roles |
| --- | --- | --- |
| POST | `/auth/login` | public (10/min per IP) |
| POST | `/auth/refresh` | public (refresh cookie) |
| POST | `/auth/logout` | any |
| POST | `/auth/change-password` | any |
| POST | `/auth/accept-invite` | public (invite token) |
| GET | `/users/me` | any |
| PATCH | `/users/me/usage-notice` | any |
| GET | `/users` | admin |
| GET | `/users/invitations` | admin |
| POST | `/users/invitations` | admin |
| POST | `/users/invitations/:id/resend` | admin |
| DELETE | `/users/invitations/:id` | admin |
| GET | `/users/:id` | admin |
| PATCH | `/users/:id` | admin |
| PUT | `/users/:id/model-access` | admin |
| PUT | `/users/:id/feature-access` | admin |
| POST | `/users/:id/reset-password` | admin |
| DELETE | `/users/:id` | admin |
| GET/POST | `/access-profiles` | admin |
| GET | `/access-profiles/models` | admin |
| GET/PATCH/DELETE | `/access-profiles/:id` | admin |
| PUT | `/access-profiles/:id/models` | admin |
| PUT | `/access-profiles/:id/features` | admin |

Packages are stored as access profiles (`/access-profiles` is the package API). Create/update
bodies accept `price_idr` (monthly price), `tier_label` (chip shown on the card) and
`overage_action` (`cutoff` = block once a quota window is exhausted, `allow` = keep serving).
`GET /users` also returns a per-user `usage` object (`five_hour`/`weekly` used and limit tokens)
for the console quota bars.

**Usage scope.** `GET /usage/stats` and `GET /usage/events` are team-wide for admins when no
`user_id` is supplied, and scoped to the caller for members. Passing `user_id` always narrows to
that single user (admins only).

**Dashboard fields.** `GET /usage/stats` returns `totals.avg_latency_ms`, `totals.client_4xx`,
`totals.server_5xx`, plus `by_provider`, `by_status_code` and `hourly` arrays.
`GET /usage/events` items carry `upstream_status` (the HTTP status 9router returned, `null` when
the request never reached it) and the client identity (`user_email` / `user_name`).
| GET | `/models` | admin |
| GET | `/models/available` | any |
| POST | `/models/sync` | admin |
| PATCH | `/models/:id` | admin |
| GET | `/features` | admin |
| PATCH | `/features/:id` | admin |
| GET | `/api-keys` | any (own) / admin (`?user_id=`) |
| POST | `/api-keys` | any |
| DELETE | `/api-keys/:id` | any (own) / admin |
| GET | `/usage/summary` | any (own) / admin (`?user_id=`) |
| GET | `/usage/events` | any (own) / admin |
| GET | `/usage/stats` | any (own) / admin |
| GET | `/usage/export` | any (own) / admin (CSV, ≤90 days) |
| GET/PATCH | `/settings` | admin |
| POST | `/settings/test-upstream` | admin |
| GET | `/audit-logs` | admin |

## AI gateway — `/v1`

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/v1/models` | API key |
| POST | `/v1/chat/completions` | API key (streaming and non-streaming) |

## Health

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | public; 200 healthy/degraded, 503 unhealthy |

## Response headers

Every gateway response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
`X-RateLimit-Reset`, `X-Usage-5h-Remaining`, and `X-Usage-Weekly-Remaining` (`-1` = unlimited).
A 429 includes `Retry-After` in seconds.
