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
