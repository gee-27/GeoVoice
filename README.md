# GeoVoice

A geography quiz application for solo and live group play.

GeoVoice is a geography quiz application with username/password sign-in and a one-time face capture for new-account registration. The captured image becomes the user's profile photo. Account data and quiz results are stored in PostgreSQL and work across devices.

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
- One-time recovery code for password reset.
- Password change, face re-enrollment, recovery-code replacement, data export, account deletion, and sign-out.
- Eighty geography questions across eight categories, randomized answers, spoken/clicked/typed input, question narration, immediate explanations, automatic progression with pause, and paginated history.
- Live expeditions: a signed-in host sets a room limit from 1 to 30, then creates a six-digit PIN and QR link. Guests join by nickname without accounts. The host can assign Atlas or Voyagers teams, and all players see timed rounds and live standings.
- Live scoring awards 600 points for a correct answer plus up to 400 based on remaining time. The server keeps answers private until each six-second reveal and advances the room automatically.
- Server-owned answer keys and scoring, with duplicate submission protection.
- PostgreSQL migrations and cleanup, Vercel function adapter, Dockerfile, health endpoint, and security headers.
- Responsive layout and accessible labels, native dialogs, keyboard focus, live status messages, and reduced-motion support.

## Sign-in and recovery

When face registration is enabled, registration collects a username, display name, password, consent, one clear face sample, and a small profile photo captured from the same camera frame. Successful registration signs the user in and displays a one-time recovery code. Returning sign-in uses the username and password only; the camera is not requested again.

Store the recovery code privately: it can reset a forgotten password. Recovery consumes the old code, issues a replacement, and revokes other sessions. There is no self-service recovery without this code.

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

The public deployment requires the configured PostgreSQL database and Vercel environment variables described in [DEPLOYMENT.md](DEPLOYMENT.md).

## Main files

- `dist/`: public application, styles, face models, and vendored face-api.js.
- `backend/api.mjs` and `backend/live.mjs`: authenticated API, account management, solo quizzes, and live rooms.
- `backend/security.mjs`: password hashing, face encryption, validation, and recovery codes.
- `backend/schema.sql`: PostgreSQL schema.
- `backend/questions.js`: server-only question bank and answer keys.
- `api/index.mjs`: Vercel entry point.
- `server.mjs`: standalone Node server for local/Docker use.
- `scripts/`: setup, migrations, source validation, and cleanup.
- `tests/`: backend and interface workflows, algorithm checks, asset integrity.

Third-party face-api.js 0.22.2 and model assets are included. Its MIT license is in `dist/vendor/LICENSE.face-api.txt`; bundled checksums are in `asset-checksums.json`. The library is a legacy dependency; a clean npm audit of the server packages does not audit that vendored browser library or certify model accuracy.

## Tropical explorer interface

The interface combines a retro explorer workstation with modern readability. Ocean blue, coral, sunshine yellow, and warm cream appear in desktop-style windows, title bars, file-like topic tiles, terminal labels, outlined controls, and offset shadows. Questions, instructions, forms, and touch targets retain modern sizing and spacing. Topic tiles select a quiz category. All eighty questions have explicit subject-image assignments, independent of their correct answers. Country flags provide context for capital questions; physical-geography questions use corresponding landscape scenes or a neutral globe. See PHOTO-CREDITS.md for sources and the no-answer-clue policy.

Camera enrollment and verification use a focused screen with navigation hidden, webcam controls, and back actions. Active quizzes hide the sidebar, profile control, and footer, retain voice/type/click answers and progress, and confirm before quitting to home. Answer cards use letters and shapes as well as color, with explicit correctness labels after submission. Reduced-motion preferences and mobile layouts are supported.

## Profile snapshots and animated countdown

During new-account registration, GeoVoice confirms that exactly one clear face is visible and saves a 256-pixel square JPEG from that frame as the profile photo. The image and numerical face sample are encrypted in PostgreSQL. The photo is available only to the signed-in owner and can be removed under **My profile**. Returning sign-ins do not use the camera or compare the saved face.

Run `npm run db:migrate` before deploying this update. The additive `photo_cipher` column retains schema version 2 for compatibility with the currently running version, preserves accounts and history, and does not expire sessions. Keep the existing encryption key. The five-second feedback countdown shows changing seconds and a shrinking bar; Pause, navigation, quit confirmation, and tab hiding cancel advancement. Reduced-motion mode displays the numeric countdown without the moving bar.


## Face recognition switch

Set `FACE_RECOGNITION_ENABLED=1` to require a one-time face capture when a new account is registered. The Vercel configuration enables it for the public deployment. Set it to `0` only when you need to allow registration without a camera. For local development, change the value in the ignored `.env` file and restart the server. This switch does not affect returning sign-in, which always uses username and password.


## Expanded geography question bank

GeoVoice now has 80 questions across eight categories. The four new categories are Maps & navigation, Climate & weather, Natural landmarks, and Countries & cultures. Each contains three easy, four medium, and three hard questions. Every question has an explicit local image assignment in `dist/visuals.js`; the 17 new SVG illustrations use no answer text or location labels. Edit questions and explanations in `backend/questions.js`, and consult `QUESTION-SOURCES.md` for primary references.
