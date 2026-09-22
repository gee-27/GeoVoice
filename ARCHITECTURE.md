# Architecture and security

## Request flow

```
Browser UI + local face model
    | HTTPS, same-origin JSON, HttpOnly cookie + CSRF header
Vercel Node function / standalone Node API
    | pooled PostgreSQL connection
PostgreSQL
```

## Identity state machine

- Anonymous users can view public configuration, register, sign in, or initiate recovery.
- Registration validates password, consent, and three face descriptors; successful enrollment creates a full session and recovery code.
- Returning login validates the password and creates a face-stage session.
- Face verification compares two descriptors against the stored encrypted enrollment samples; success replaces that session with a full session.
- Recovery uses a high-entropy one-time code. A transaction locks the account, rechecks and consumes the code, replaces the password, rotates the recovery code, and revokes all previous sessions. The recovery code replaces normal password/face checks.
- API authorization checks the full stage, database session validity, account verification, and account authentication version on every protected request.

No client-provided role, score, user ID, or face-success flag grants access.

## Persistent records

- `users`: username, name, salted password hash, authenticated encrypted face data, hashed recovery code, consent record, authentication version.
- `sessions`: hash of random cookie token, random CSRF token, account ID, authentication stage and timestamps.
- `quizzes`: account ID, server-generated question/answer order, submitted answers, timestamps, completion status.
- `rate_limits`: hashed/keyed subjects, counts, reset timestamps; durable across function invocations.
- `metadata`: schema version and encryption-key fingerprint.

Foreign keys cascade on account deletion. Schema creation is transactional and idempotent. Production uses PostgreSQL; no SQLite file or browser database is used for shared accounts.

## Protection details

- Passwords: scrypt with random 16-byte salt, N=2^17, r=8, p=1, 64-byte derived key. Concurrent hashing is bounded per function instance.
- Face data: AES-256-GCM with a random 12-byte nonce, per-record context as associated data, and a deployment secret outside the database.
- Session cookies: random 256-bit tokens; only their hashes are stored. Production uses a `__Host-` cookie, Secure, HttpOnly, SameSite=Strict, Path=/, with no Domain attribute.
- Full sessions: 12-hour absolute expiry and 30-minute idle expiry. Pending verification: 10 minutes. Password/face changes and recovery revoke other sessions.
- CSRF: exact configured Origin, JSON content type, a custom request header, and a per-session CSRF token for session-bound writes. No cross-origin API allowance.
- Request limits: bounded body size, per-IP API/auth limits, per-account password and face checks, and per-username recovery limits.
- Queries: parameterized SQL. Quiz scoring and ownership are checked server-side. Row locks prevent concurrent answer submission from advancing a quiz twice. Repeated identical submissions return the existing outcome.
- Browser: same-origin assets, no remote scripts/fonts, CSP, clickjacking protection, camera/microphone permission policy. API responses are not cached.
- Deployment: API secrets never enter public output. Vercel uses a server-side PostgreSQL pool; a separate migration step prepares the database. The static `dist/` directory alone is no longer a complete deployment.

## Limits that remain relevant

Face descriptors originate in the browser. A hostile client can fabricate or replay them; this implementation does not have certified liveness or presentation-attack detection. Face verification is therefore not claimed as an independent strong security factor. Passwords remain mandatory for ordinary sign-in. This app does not claim phishing-resistant authentication.

The initial face threshold (0.48) must be evaluated with representative users and devices. Voice accuracy depends on the browser service, language/accent, and environment. Forty questions are suitable for the current educational scope; adding more content requires editing the server question bank and deploying it.

Existing local IndexedDB records are neither uploaded nor deleted. Consent must be obtained for the new online account. Backups can retain deleted records until provider retention ends; the operator must choose and explain that policy.

The test suite verifies application rules, not production provider configuration, real-world biometric accuracy, legal compliance, or independent penetration testing.

## API map

| Endpoint | Access / action |
|---|---|
| `GET /api/config`, `GET /api/health` | Public configuration and health |
| `GET /api/session` | Current session stage; no credentials/templates |
| `POST /api/auth/register` | Enrolled account + full session + recovery code |
| `POST /api/auth/login` | Password -> face-stage session |
| `POST /api/auth/face` | Face-stage -> full session |
| `POST /api/auth/recover` | One-time recovery code -> password reset, code rotation, full session |
| `POST /api/auth/logout` | Revoke current session |
| `POST /api/account/password` | Current password required; revoke other sessions |
| `POST /api/account/face` | Current password required; replace template |
| `POST /api/account/recovery-code` | Replace the recovery code |
| `GET /api/account/export` | Own profile and history; excludes credentials/templates |
| `DELETE /api/account` | Current password required; cascade deletion |
| `POST /api/quizzes` | Generate randomized server-owned quiz |
| `GET /api/quizzes/:id` | Own quiz state or completed result |
| `POST /api/quizzes/:id/answer` | Submit one indexed answer, idempotently |
| `GET /api/history?page=0` | Own paginated results and totals |
| `GET /api/maintenance` | Cron bearer secret required; expired-data cleanup |

References:
- https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
