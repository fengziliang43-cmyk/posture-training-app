# Project Rules

## Project Goal

This project designs and implements a privacy-first posture-and-training app. The app should prioritize safety, posture, sustainable training, then conditioning.

## Current Phase

The current phase is open-source preparation and migration to the `shengjidaguai-china` community organization. The complete 1.0.5 application source is being made the default `main` branch, while production deployment remains an independent, explicitly authorized operation.

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

## GitHub Source-of-Truth Workflow

- GitHub is the canonical source for application code and reviewable documentation after a commit has been tested, pushed, and read back from the remote.
- Make changes in a clean local clone or disposable worktree, run the required checks, commit intentionally, then push only with the explicit authorization required above.
- Do not delete individual tracked source files after pushing; Git would interpret that as a project deletion. A disposable worktree or generated build output may be removed only after remote, production, and artifact verification and separate deletion confirmation.
- Production deployments must use an exact Git commit or release tag in a new immutable release directory, followed by an atomic switch and a retained rollback target. Do not update production by pulling into a dirty working directory.
- Runtime databases, uploads, body photos, `.env` files, credentials, signing keys, and private health data remain outside GitHub.

## Public Collaboration Rules

- Source code and original project material are released under the MIT License unless a file explicitly states otherwise. Third-party packages, linked videos, platform SDKs, and external services retain their own terms.
- Never place real health records, posture photos, names, email addresses, credentials, access tokens, server logs, or production data in an Issue, Discussion, Pull Request, test fixture, screenshot, or commit.
- Security vulnerabilities must be reported through GitHub private vulnerability reporting. Public Issues should contain only the minimum non-sensitive reproduction details.
- Contributions that affect training decisions or medical-boundary copy must preserve the red-flag stop rules, non-diagnostic language, and existing safety tests.
- Pull Requests must describe the user-facing outcome and include proportionate tests. Run `npm test`, `npm run lint`, `npm run build`, and `git diff --check` before requesting review.
- The project lead remains `@fengziliang43-cmyk`. Repository transfer does not authorize contributors or community administrators to deploy production, change DNS, access runtime data, or rotate credentials.
