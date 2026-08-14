[中文](README.md) | [English](README_EN.md)

# Zixu

> A safety-first, account-isolated posture and training planner that combines onboarding, daily readiness, workouts, posture records, and long-term trends.

![Status](https://img.shields.io/badge/status-release%20candidate-2f855a)
![App](https://img.shields.io/badge/app-PWA%20%2B%20Android%20%2B%20iOS-2563eb)
![Privacy](https://img.shields.io/badge/privacy-account%20isolated-7c3aed)
![Safety](https://img.shields.io/badge/training-safety%20first-d97706)

## Purpose

Zixu is a record-oriented training companion. Onboarding first limits the exercise pool and initial difficulty; daily readiness then selects a conservative workout or recovery task while longer-term feedback drives progression.

Its priorities are fixed:

```text
Safety -> Posture -> Fat loss -> Muscle gain -> Conditioning
```

> [!IMPORTANT]
> This project is a training aid, not a medical diagnostic or treatment tool. Stop training and seek appropriate medical assessment for red-flag symptoms. A worsening condition or increased pain should downgrade the plan, not be pushed through.

## Current Status

The current candidate contains the latest PWA, Fastify and SQLite application, Android/iOS Capacitor projects, onboarding, multi-user isolation, persistent sessions, personal export/deletion, Adaptive V3 planning, and exercise video links. A candidate branch is not evidence of a push, merge, or production deployment.

From the candidate directory:

```bash
npm ci
npm test
npm run lint
npm run build
```

A typical local development session starts the server and web app separately:

```bash
npm run dev:server
npm run dev:web
```

Default addresses:

```text
API server: http://localhost:8787
Web app:    http://localhost:5173
```

## Core Loop

```text
Daily status -> Readiness decision -> Train / Deload / Recover -> Check in -> Review trends -> Compare posture
```

The current candidate includes:

- Accounts and onboarding: open registration is controlled by a production release gate; new users complete adult confirmation, goals, equipment, capacity, and limitations first.
- Daily status: discomfort, energy, available training time, and optional sleep, steps, diet, and weight inputs.
- Plan generation: profile, daily readiness, and historical feedback form three matching layers; red flags always take priority.
- Exercise library: pulling, scapular control, core stability, lower-body and recovery work with reviewed direct video links.
- Records: trends, calendar states, training frequency, and exercise progression.
- Posture: local front, side, and back photo records with manual same-angle comparison.
- Settings: connection status, reminders, personal export, account deletion, and controlled DeepSeek explanations.
- Clients: one React codebase for PWA, Android, and iOS.

## Product Principles

- Data minimization: runtime data stays in controlled SQLite and file storage, isolated by account; posture photos are optional.
- Safety first: automatically downgrade the session when readiness is poor.
- Low friction: keep the essential daily input brief.
- No diagnosis: support training without replacing medical assessment or treatment.
- Reviewable: focus on long-term patterns instead of isolated check-ins.
- Rule-based decisions: local rules decide training; AI is reserved for explanations and reviews and must not read posture photos.

## Technical Direction

| Layer | Choice |
| --- | --- |
| Frontend | Vite + React + PWA |
| Backend | Node.js + Fastify |
| Data | SQLite + local file system |
| Mobile | Capacitor Android + iOS |
| Access | Trusted private network for local tests; HTTPS reverse proxy to a loopback-only API in production |
| AI | DeepSeek for explanations and reviews only; local rules continue to decide training |

## Documentation

- [Design specification](docs/superpowers/specs/2026-06-11-posture-training-app-design.md)
- [Implementation plan](docs/superpowers/plans/2026-06-11-posture-training-app-implementation.md)
- [Registration and onboarding specification](docs/superpowers/specs/2026-08-09-open-registration-onboarding-design.md)
- [Adaptive V3 specification](docs/superpowers/specs/2026-07-15-adaptive-training-engine-design.md)
- [Alibaba Cloud runbook](docs/setup/aliyun.md)
- [Public deployment blockers](docs/setup/public-web-deployment.md)
- [Project rules](AGENTS.md)

The repository links above use relative paths and do not depend on a local path from any specific computer.

## Privacy and Security Boundaries

Do not commit:

- Posture or training photos, or any private health information.
- Runtime databases such as `data/*.sqlite`.
- `.env` files, API keys, tokens, passwords, or other credentials.
- APKs, build output, caches, or `node_modules/`.

Posture photos must not be sent to third-party AI services. The production API binds only to loopback and is reached through an HTTPS reverse proxy. Passwords use bcrypt hashes, and only SHA-256 token digests are stored for sessions. Production registration remains closed unless `REGISTRATION_ENABLED=true` is explicitly set.

## Next Steps

- Validate migration, integrity, and rollback on an isolated copy of the production database.
- Complete candidate tests, builds, privacy scans, and mobile project checks.
- After compliance and deployment gates are satisfied, separately authorize the GitHub push, `body.liang111.top` DNS, and production release. The root domain remains the site entrance and `quant.liang111.top` remains reserved for the quant project.
