# Project Rules

## Project Goal

This project designs and implements a privacy-first posture-and-training app. The app should prioritize safety, posture, sustainable training, then conditioning.

## Current Phase

The current phase is a release-candidate integration on `codex/latest-candidate-20260814`. It combines the latest application snapshot with the audited server hardening baseline. A candidate commit is not authorization to push, merge, deploy, change DNS, or open registration.

## Directory Rules

- `docs/superpowers/specs/`: approved design specs.
- `docs/superpowers/plans/`: implementation plans.
- `docs/setup/`: local, mobile, and deployment runbooks without machine-specific paths or credentials.
- `deploy/`: reviewable examples and production hardening templates; applying them to a server requires explicit authorization.
- `ios/` and `android/`: source project files only. Build output, signing material, provisioning profiles, APKs, IPAs, DerivedData, and local SDK state must remain outside git.
- `.superpowers/`: temporary visual brainstorming mockups and state.
- App code should not be added until the spec and implementation plan are approved.

## Privacy Rules

- Do not copy real body photos or identifiable user records into the repository.
- Do not commit private photos, real health profiles, names, birth data, local usernames, secrets, API keys, or credentials.
- Use synthetic examples in tests and documentation.
- Treat posture and health notes as private runtime data stored outside git.
- Do not copy a production database into the repository or print real user rows during migration verification. Use an isolated copy and report only schema/integrity aggregates.

## Training Safety Rules

- This app is not medical diagnosis or treatment.
- The app must not encode or infer a real person's diagnosis or medical history in source control.
- Training recommendations should prioritize conservative progression, pain feedback, core stability, hip control, and avoiding aggressive loading when pain or fatigue is high.
- Red-flag symptoms must stop automatic training recommendations and prompt professional medical evaluation.

## Release and Deployment Rules

- Keep the root domain as the website entrance. The posture app targets `body.liang111.top`; the quant app targets `quant.liang111.top`. Do not change live DNS while a compliance review is pending.
- Production registration is fail-closed unless `REGISTRATION_ENABLED=true` is explicitly set. The web UI and API must both enforce this gate.
- Production API traffic must enter through HTTPS reverse proxy; Fastify binds only to loopback. Secrets and real environment files are created on the server and never committed.
- Before a candidate commit, run `npm test`, `npm run lint`, `npm run build`, a sensitive-path scan, and a generated-artifact scan.
- Before a database migration, make a recoverable backup and validate the migration on an isolated copy with `PRAGMA integrity_check` and `PRAGMA foreign_key_check`.
- Git push, merge, production deployment, DNS changes, registration enablement, and app-store publishing require separate explicit authorization.
