# Deploy GeoVoice on Vercel

## What you need

1. A Vercel account for the web application and Node API.
2. A PostgreSQL database, for example a Neon project. Use a pooled connection string for Vercel functions.
3. An operator name and a contact email for privacy requests.

Vercel Hobby is intended for personal, non-commercial projects and has usage caps. Hosting eligibility does not make PostgreSQL usage free. Check the current plans before signing up:

- Vercel Hobby: https://vercel.com/docs/plans/hobby
- Neon: https://neon.com/pricing

## 1. Create a Vercel account

1. Open https://vercel.com/signup.
2. Choose **Continue with GitHub** (convenient for repository deployment), or another offered sign-in method.
3. Complete account verification. Choose a personal/Hobby account if your use qualifies.
4. Open the Vercel dashboard. Do not paste secrets into your repository.

Account sign-up and acceptance of the provider's terms are performed by you.

## 2. Create the database

1. Create a PostgreSQL project with your provider. Pick a region near your users and configure the Vercel function region nearby if available on your plan.
2. Copy the pooled PostgreSQL connection URL. Keep the provider's TLS parameters intact; do not disable certificate validation.
3. Use a separate database/branch for Preview and Development. Do not connect untrusted preview deployments to your production database.
4. Save the URL privately as `DATABASE_URL`.

The application needs permission to read/write its tables. Run migrations with a role that can create those tables; for stricter deployments, grant the runtime role only the required CRUD access after migration. No database credential is exposed to the browser.

## 3. Prepare local secrets and schema

Install Node.js 24 and open a terminal in the `geovoice` folder:

```sh
npm ci
npm run setup
```

Edit `.env` locally. It is ignored by Git and excluded from distribution/deployment uploads. Preserve the generated keys. Add the real database value.

```sh
npm run db:migrate
npm test
npm run check
```

The migration is idempotent and uses a PostgreSQL advisory lock. Run it against the intended production database before enabling production traffic. The normal Vercel build checks source but does not silently modify your database.

## 4. Import the source

1. Create a private GitHub repository and add the source folder. Exclude `node_modules`, `.env`, local data, and backups; `.gitignore` is included.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Set the root directory to the folder containing `package.json` and `vercel.json`.
4. Use **Other** as the framework if Vercel asks. The included `vercel.json` supplies:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Node runtime: `24.x` from package.json
   - API function: `api/index.mjs`
   - `/api/*` routing and security headers
5. Set the environment variables below before enabling public traffic. Do not set secret variables with a public/browser prefix.

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `APP_ORIGIN` | Exact primary URL, e.g. `https://your-project.vercel.app`, without a trailing slash |
| `DATABASE_URL` | Pooled PostgreSQL connection string with TLS enabled |
| `FACE_ENCRYPTION_KEY` | The generated base64 encryption key; 32 random bytes |
| `OPERATOR_NAME` | Name of the responsible operator |
| `PRIVACY_CONTACT` | Working email address for user requests |
| `REGISTRATION_OPEN` | `0` during setup, `1` when ready for registrations |
| `FACE_RECOGNITION_ENABLED` | `1` to require face verification at sign-in (default); `0` for password-only sign-in |
| `CRON_SECRET` | Generated maintenance secret, used by Vercel's daily cleanup request |

If you do not know the assigned URL yet, create the deployment with registrations closed, obtain its primary URL, set `APP_ORIGIN`, and redeploy. Requests from any other origin, including arbitrary preview URLs, are intentionally rejected. Configure a separate environment for previews rather than weakening origin validation.

The encryption key is bound to the database on first successful initialization. Do not change it casually: that prevents the app from decrypting existing records, and startup will fail closed. Store a separate, secured backup of this key along with your database backup procedure.

## 5. Verify before opening registration

1. Check `https://your-domain/api/health` returns `{"status":"ok"}`.
2. Confirm the site uses HTTPS and the primary origin matches `APP_ORIGIN`.
3. Set `REGISTRATION_OPEN=1` and redeploy when you are ready for controlled registration tests.
4. Register with your username, password, and face; save the recovery code. Sign out and complete password and face verification again.
5. Test a wrong password and wrong face. Confirm that protected quiz/history requests remain denied until both checks complete.
6. Test the actual camera and microphone on your intended desktop and mobile browsers. Check permission denial and the webcam picker.
7. Complete a quiz, reload, and verify the same history from another device after sign-in.
8. Confirm account recovery, deletion, and data export using disposable test accounts.
9. In Vercel, verify the daily `/api/maintenance` job succeeds. It requires `CRON_SECRET` and removes expired sessions, expired unfinished quizzes, stale rate-limit entries, and old unverified registrations.

If any check fails, close registration with `REGISTRATION_OPEN=0` while fixing it. This flag closes signup only; use provider access controls if you need to take the entire site offline.

## 6. Backups, monitoring, and updates

- Enable database backups or point-in-time recovery according to your provider's plan. A free plan may not provide the recovery window you need.
- Record your retention policy and test a database restore into an isolated environment together with the original encryption key.
- Monitor `/api/health`, Vercel errors/latency, database connection usage.
- The app logs request IDs and generic server failure events, not passwords, templates, or recovery codes. Keep infrastructure log access restricted.
- Keep Node 24 patches and dependencies updated. Audit vendored browser code separately from npm runtime packages.
- Before schema changes, back up the database and use backward-compatible migrations so an application rollback remains possible.

## Optional: Docker hosting instead of Vercel

The same API can run in a Node container. Configure `.env` with production values and a PostgreSQL service, then run:

```sh
docker compose build
docker compose run --rm geovoice node scripts/migrate.mjs
docker compose up -d
```

The container binds port 4173 to the host loopback interface only. Put an HTTPS reverse proxy in front of it and configure it to overwrite `X-Forwarded-For` with trustworthy client information. `TRUST_PROXY=1` must only be used behind your trusted proxy. Run `npm run db:cleanup` daily from a scheduler when not using Vercel cron.

The Docker image and cloud deployment must be verified in your hosting account; neither was executed against production infrastructure during development.

## Upgrading an existing database

Keep the original FACE_ENCRYPTION_KEY and back up the database before migration. Run `npm run db:migrate` before deploying this version. It removes obsolete phone/verification columns and expires existing sessions once; accounts and quiz history remain. Repeating the migration does not sign users out again. Remove TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID, and SMS_DAILY_LIMIT from Vercel if previously added. No SMS service is required.

The profile-photo update requires another idempotent `npm run db:migrate` before deployment to add `users.photo_cipher`. It preserves existing data and the current schema-version compatibility.

## Switching face recognition

In Vercel, open **Project → Settings → Environment Variables**. Set `FACE_RECOGNITION_ENABLED` to `0` for password-only access or `1` to require face verification for accounts that have enrolled a face. Apply it to Production (and Preview/Development if needed), save, then redeploy. The application also works with the variable unset; it defaults to enabled.

When disabled, new accounts use password-only sign-in and are not asked for camera permission. Existing encrypted face templates are retained. Accounts without a template can use password sign-in and enroll one from **My profile**; once enrolled, they will use face verification the next time the feature is enabled. Run `npm run db:migrate` before deploying this version; migration makes the face template optional for new password-only accounts.
