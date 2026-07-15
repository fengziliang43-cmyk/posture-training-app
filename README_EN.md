[中文](README.md) | [English](README_EN.md)

# Posture & Training Companion

> A local-first personal posture and training planner that brings daily readiness, workouts, posture records, and long-term trends into one low-friction loop.

![Status](https://img.shields.io/badge/status-MVP%20on%20feature%2Fmvp-2f855a)
![App](https://img.shields.io/badge/app-PWA%20%2B%20Android%20APK-2563eb)
![Privacy](https://img.shields.io/badge/privacy-local%20first-7c3aed)
![Safety](https://img.shields.io/badge/training-safety%20first-d97706)

## Purpose

This project is a personal, record-oriented training companion. It evaluates daily readiness, suggests a conservative and progressive workout or recovery task, and tracks completion and posture trends over time.

Its priorities are fixed:

```text
Safety -> Posture -> Fat loss -> Muscle gain -> Conditioning
```

> [!IMPORTANT]
> This project is a training aid, not a medical diagnostic or treatment tool. Stop training and seek timely medical care for red-flag symptoms such as numbness, radiating pain, marked weakness, bowel or bladder changes, or sudden sharp pain. A worsening condition or increased pain should downgrade the plan, not be pushed through.

## Current Status

| Branch | Status | Description |
| --- | --- | --- |
| `main` | Documentation line | Contains the project rules, design specification, and implementation plan. |
| `feature/mvp` | Runnable MVP | Contains the PWA, Fastify server, SQLite storage, local photo upload, Android debug APK workflow, and latest UI. |

To inspect or run the application, switch to `feature/mvp`:

```bash
git checkout feature/mvp
npm install
npm test
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

The first version is designed around:

- Daily status: lower-back discomfort, energy, available training time, and optional sleep, steps, diet, and weight inputs.
- Plan generation: template selection based on red flags, discomfort, energy, sleep, time, and weekly progress.
- Exercise library: pulling, scapular control, core stability, hip and pelvic stability, and recovery work.
- Records: trends, calendar states, training frequency, and exercise progression.
- Posture: local front, side, and back photo records with manual same-angle comparison.
- Settings: local server, connection status, reminders, reserved DeepSeek configuration, and backup export.

## Product Principles

- Local first: training records, photos, and configuration stay on the user's devices by default.
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
| Mobile | Android browser first, then Capacitor APK packaging after stabilization |
| Access | A local Mac server reached from the phone through a private Tailscale network |
| AI | DeepSeek for explanations and reviews only; local rules continue to decide training |

## Documentation

- [Design specification](docs/superpowers/specs/2026-06-11-posture-training-app-design.md)
- [Implementation plan](docs/superpowers/plans/2026-06-11-posture-training-app-implementation.md)
- [Project rules](AGENTS.md)

The repository links above use relative paths and do not depend on a local path from any specific computer.

## Privacy and Security Boundaries

Do not commit:

- Posture or training photos, or any private health information.
- Runtime databases such as `data/*.sqlite`.
- `.env` files, API keys, tokens, passwords, or other credentials.
- APKs, build output, caches, or `node_modules/`.

Posture photos should remain on personal devices and must not be sent to third-party AI services. Do not expose the service directly to the public internet; use a private network such as Tailscale for remote access. Account passwords must be securely hashed and never stored as plaintext.

## Next Steps

- Continue validating the latest APK on a real phone.
- Refine the Today, Records, and Posture views from actual use.
- Keep the training rules conservative and do not trade safety for visual or feature complexity.
