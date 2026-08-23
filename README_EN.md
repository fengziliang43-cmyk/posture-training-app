[中文](README.md) | [English](README_EN.md)

# Zixu

> A safety-first, account-isolated posture and training planner that combines onboarding, daily readiness, workouts, posture records, and long-term trends.

![Version](https://img.shields.io/badge/version-1.0.5-2f855a)
![App](https://img.shields.io/badge/app-PWA%20%2B%20Android%20%2B%20iOS-2563eb)
![Privacy](https://img.shields.io/badge/privacy-account%20isolated-7c3aed)
![Safety](https://img.shields.io/badge/training-safety%20first-d97706)

[Open the Web App](https://body.liang111.top/) · [Download Android 1.0.5](https://body.liang111.top/releases/zixu-android-1.0.5.apk) · [Checksum](https://body.liang111.top/releases/zixu-android-1.0.5.apk.sha256) · [Release Manifest](https://body.liang111.top/api/releases/latest)

## Purpose

Zixu is a record-oriented training companion. Onboarding first limits the exercise pool and initial difficulty; daily readiness then selects a conservative workout or recovery task while longer-term feedback drives progression.

Its priorities are fixed:

```text
Safety -> Posture -> Fat loss -> Muscle gain -> Conditioning
```

> [!IMPORTANT]
> This project is a training aid, not a medical diagnostic or treatment tool. Stop training and seek appropriate medical assessment for red-flag symptoms. A worsening condition or increased pain should downgrade the plan, not be pushed through.

## Current Release

Version `1.0.5` keeps the Web/PWA and signed Android package in sync. The iOS Capacitor project is maintained in the same source tree, but there is currently no public App Store, TestFlight, or IPA download. The public service uses HTTPS and isolates registration, sessions, training records, and posture photos by account.

Highlights in this release:

- One-time four-digit image captchas for login and registration, alongside server-side rate limits.
- Per-account DeepSeek API keys, encrypted on the server with AES-256-GCM and never returned by settings APIs.
- A six-character minimum for registration and password changes, with a clear recommendation to use a unique password of at least ten characters.
- Login with either an account name or a standard email address such as QQ Mail or Gmail; duplicate accounts receive a clear response.
- Operations data remains in a separate administrator area and is not exposed in ordinary account pages.

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

The product includes:

- Accounts and onboarding: public registration with captcha protection and account-name or email login; new users complete adult confirmation, goals, equipment, capacity, and limitations first.
- Daily status: discomfort, energy, available training time, and optional sleep, steps, diet, and weight inputs.
- Plan generation: profile, daily readiness, and historical feedback form three matching layers; red flags always take priority.
- Exercise library: pulling, scapular control, core stability, lower-body and recovery work with reviewed direct video links.
- Records: trends, calendar states, training frequency, and exercise progression.
- Posture: front, side, and back photos stored on the Zixu server for manual same-angle comparison; no AI or medical diagnosis.
- Me and Settings: password change, update checks, personal export, account deletion, and per-account DeepSeek configuration.
- Clients: one React codebase for PWA, Android, and iOS.

## Product Principles

- Data minimization: runtime data stays in controlled server-side SQLite and file storage, isolated by account; posture photos are optional.
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
| Data | Server-side SQLite + controlled file storage, isolated by account |
| Mobile | Capacitor Android + iOS |
| Access | [body.liang111.top](https://body.liang111.top/); HTTPS reverse proxy to a loopback-only API |
| AI | DeepSeek for explanations and reviews only; local rules continue to decide training |

## Android Installation and Updates

1. Open the [official Android download](https://body.liang111.top/releases/zixu-android-1.0.5.apk) on the phone.
2. Android completes the installation flow. First-time installation may require enabling “Install unknown apps” for the browser or file manager.
3. Installation always requires user confirmation; Zixu does not bypass Android with silent installation.
4. Use the published [SHA-256 checksum](https://body.liang111.top/releases/zixu-android-1.0.5.apk.sha256) to verify the package.
5. “Me → Settings → Check for updates” reads the official release manifest and lets the user choose whether to download a newer package.

## Operations Dashboard

The operations area is not an ordinary user feature. An administrator first signs in on the [Zixu home page](https://body.liang111.top/) and then opens the [administrator dashboard](https://body.liang111.top/admin). It shows aggregate account, activity, and training metrics and links to a protected GoAccess traffic report. Ordinary accounts neither see the entry nor gain access to administrator APIs.

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

Posture photos are stored only in account-isolated directories on the Zixu server and are not sent to DeepSeek or other third-party AI services. Per-account DeepSeek API keys use AES-256-GCM encryption and are excluded from personal backups and settings responses. The production API binds only to loopback and is reached through an HTTPS reverse proxy. Passwords use bcrypt hashes, only SHA-256 token digests are stored for sessions, and login and registration require one-time image captchas. Registration, captcha enforcement, and personal API keys retain production emergency switches.

## Release and Verification

Production follows “test → commit → push → remote readback → exact-commit build → immutable production release → atomic switch,” with the previous release retained for rollback. The source repository does not contain APK files, runtime databases, uploaded photos, `.env` files, API keys, or signing certificates.
