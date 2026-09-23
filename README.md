# GeoVoice

A Quizizz-style web application for learning geography.

GeoVoice is a geography quiz application with username/password sign-in and face verification. The same face may be used for multiple uniquely named accounts. Account data and quiz results are stored in PostgreSQL and work across devices.

## Start here

- **Public deployment:** follow [DEPLOYMENT.md](DEPLOYMENT.md) for Vercel and PostgreSQL.
- **Local development:** install Node.js 24, then follow the commands below.
- **Verification report:** see [TESTING.md](TESTING.md).
- **Architecture and security boundaries:** see [ARCHITECTURE.md](ARCHITECTURE.md).

```sh
npm ci
npm run setup
```

Edit the generated `.env` locally with your PostgreSQL connection string and operator details. The setup command generates encryption and maintenance secrets without printing them. Never paste secrets into chat or commit `.env`.

```sh
npm run db:migrate
npm start
```

Open http://localhost:4173. No phone number or SMS provider is required.

## Features

- Unique usernames and long passwords; account names may be shared.
- Three face enrollment captures; two returning verification captures matched on the server.
- Explicit camera selection, remembered as a device preference; camera stops after capture.
- Identity-confirmed notification after all sign-in steps complete.
- Ten or more accounts can use the same face; each account keeps independent results.
- One-time recovery code for password reset or inaccessible face verification.
- Password change, face re-enrollment, recovery-code replacement, data export, account deletion, and sign-out.
- Forty geography questions, randomized answers, spoken/clicked/typed input, question narration, immediate explanations, automatic progression with pause, and paginated history.
- Server-owned answer keys and scoring, with duplicate submission protection.
- PostgreSQL migrations and cleanup, Vercel function adapter, Dockerfile, health endpoint, and security headers.
- Responsive layout and accessible labels, native dialogs, keyboard focus, live status messages, and reduced-motion support.

## Sign-in and recovery

Registration collects username, display name, password, consent, and three consistent face samples. Successful enrollment signs the user in and displays a one-time recovery code. Returning sign-in requires password and face verification.

Store the recovery code privately: it can replace both ordinary sign-in checks when resetting a forgotten password or recovering access without a working camera. Recovery consumes the old code, issues a replacement, and revokes other sessions. There is no self-service recovery without this code. Signed-in users can replace their face template using their current password.

## Upgrade from the SMS version

Back up the database and retain its existing encryption key, then run `npm run db:migrate` before restarting or redeploying. Schema version 2 removes stored phone data and obsolete verification fields, expires old sessions once, and preserves accounts, encrypted face templates, recovery codes, and quiz history. Pending accounts can complete password and face sign-in within their existing 24-hour enrollment window. Remove old Twilio/SMS environment variables from your hosting settings; the application no longer reads them.

## Tests

```sh
npm test
npm run check
npm audit --omit=dev
```

Tests use an isolated embedded PostgreSQL engine (PGlite), a DOM simulator, synthetic face descriptors. They do not send messages, access your devices, or connect to your cloud database. Production uses `pg` with a real PostgreSQL connection; test utilities are development dependencies only.

## Existing version 1 browser accounts

Version 1 stored local profiles in IndexedDB. Version 2 does not upload or delete that data automatically. Existing users create new online accounts and enroll with consent. Old local scores are not imported as verified scores because they were calculated in the browser. Keep the earlier ZIP if you need to inspect/export old local records separately.

## Operational boundaries

The password protects account access. Face matching is an additional interaction, not certified liveness or proof of physical presence. A malicious client can submit fabricated descriptors, and photos or videos may fool the webcam model. Do not advertise this as certified biometric identity verification or use it for high-stakes identity decisions.

The quiz is a learning app, not a proctored exam: the server protects score computation, but it cannot prevent someone looking up an answer. Accuracy across real cameras, skin tones, lighting, accents, and browsers still requires human testing.

This code is prepared for deployment; it is not live until you provision services, configure secrets, run migrations, and deploy.

## Main files

- `dist/`: public application, styles, face models, and vendored face-api.js.
- `backend/api.mjs`: authenticated API, staged sessions, account management, quizzes, and history.
- `backend/security.mjs`: password hashing, face encryption, validation, and recovery codes.
- `backend/schema.sql`: PostgreSQL schema.
- `backend/questions.js`: server-only question bank and answer keys.
- `api/index.mjs`: Vercel entry point.
- `server.mjs`: standalone Node server for local/Docker use.
- `scripts/`: setup, migrations, source validation, and cleanup.
- `tests/`: backend and interface workflows, algorithm checks, asset integrity.

Third-party face-api.js 0.22.2 and model assets are included. Its MIT license is in `dist/vendor/LICENSE.face-api.txt`; bundled checksums are in `asset-checksums.json`. The library is a legacy dependency; a clean npm audit of the server packages does not audit that vendored browser library or certify model accuracy.

## Tropical explorer interface

The interface uses ocean blue, coral, lime, and sunshine colors across sign-in, enrollment, home, quizzes, history, profile, and dialogs. Topic tiles select a quiz category. All forty questions have explicit subject-image assignments, independent of their correct answers. Country flags provide context for capital questions; physical-geography questions use corresponding landscape scenes or a neutral globe. See PHOTO-CREDITS.md for sources and the no-answer-clue policy.

Camera enrollment and verification use a focused screen with navigation hidden, webcam controls, and back actions. Active quizzes hide the sidebar, profile control, and footer, retain voice/type/click answers and progress, and confirm before quitting to home. Answer cards use letters and shapes as well as color, with explicit correctness labels after submission. Reduced-motion preferences and mobile layouts are supported.

## Profile snapshots and animated countdown

Select **Save this capture as my profile photo** on the camera screen to save a 256-pixel square JPEG while enrolling or successfully verifying your face. Existing accounts can do this on their next sign-in, or under My profile → Update face template. Photos are optional, encrypted in PostgreSQL, available only to the fully signed-in owner, and removable independently of the face template. The profile pane and header show the saved photo; accounts without one keep their initial.

Run `npm run db:migrate` before deploying this update. The additive `photo_cipher` column retains schema version 2 for compatibility with the currently running version, preserves accounts and history, and does not expire sessions. Keep the existing encryption key. The five-second feedback countdown shows changing seconds and a shrinking bar; Pause, navigation, quit confirmation, and tab hiding cancel advancement. Reduced-motion mode displays the numeric countdown without the moving bar.


## Face recognition switch

Set `FACE_RECOGNITION_ENABLED=1` in your deployment environment to require face verification at sign-in (default). Set it to `0` to use username and password only. For local development, set the variable in your ignored `.env` file and restart the server. Redeploy after changing it in Vercel. When disabled, new accounts do not enroll or store a face template; existing templates stay encrypted in the database. Users without a template can still sign in when recognition is enabled and enroll one under **My profile → Enroll face template**. Users with an existing template will be prompted for face verification when the feature is enabled.
