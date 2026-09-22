# Verification report — GeoVoice 2.1

24 automated checks passed across the complete suite (23 checks) and the additional database-upgrade regression check. `npm run check` verifies source syntax and bundled assets.

Coverage includes registration without a phone, consent and enrollment validation, username/password followed by face verification, denied access before face verification, wrong-password and wrong-face rejection, session expiry/revocation, encrypted face storage, recovery-code rotation and reuse rejection, account deletion, CSRF/origin protection, independent accounts sharing a face, quiz ownership, server scoring, idempotent answers, model checksums, and configuration without SMS credentials.

The interface regression test connects the DOM to the real API and embedded PostgreSQL logic. It covers webcam selection/switching, enrollment, identity confirmation, saving the recovery code, quiz completion/history, password change, sign-in, face replacement, recovery, and deletion without a phone input or verification screen.

Deployment tests cover secure production cookies, authenticated maintenance, repeatable migrations, Vercel routing, and a previous-version database upgrade: phone fields are removed, sessions expire once, accounts and completed quizzes survive, password/face sign-in works afterward, and a repeated migration preserves the new session.

## Test environment and limits

Tests ran on Node.js 25.6.1 on Windows; deployment targets Node.js 24. Tests use PGlite (embedded PostgreSQL), LinkeDOM, and simulated camera/model/speech outputs. No real biometric data was collected. The tests do not contact an SMS provider, cloud database, or Vercel.

No live Vercel deployment, external PostgreSQL connection, Docker build, or physical webcam/microphone acceptance test was performed. Test the configured database and real devices before opening registration. Face matching is not certified liveness detection and no biometric accuracy percentage is claimed.

The previous production npm audit reported no known installed runtime dependency vulnerabilities. This does not audit the vendored legacy face-api.js library or constitute a penetration test.

## Acceptance checks before public launch

1. Run migrations and confirm `/api/health` returns status ok.
2. Register without a phone number; save the recovery code and test password/face sign-in.
3. Confirm wrong passwords/faces cannot access quizzes/history.
4. Exercise recovery once, confirm the old code no longer works, and save its replacement.
5. Test intended webcams, camera switching, low light, multiple faces, denied camera access, and microphone fallback.
6. Test account history across devices, password change, face replacement, export, and deletion.
7. Restore a database backup with its original encryption key in an isolated environment.
