# Project Rules

## Project Goal

This project designs and implements a privacy-first posture-and-training app. The app should prioritize safety, posture, sustainable training, then conditioning.

## Current Phase

The current phase is implementation. Follow the approved implementation plan task by task.

## Directory Rules

- `docs/superpowers/specs/`: approved design specs.
- `docs/superpowers/plans/`: implementation plans.
- `.superpowers/`: temporary visual brainstorming mockups and state.
- App code should not be added until the spec and implementation plan are approved.

## Privacy Rules

- Do not copy real body photos or identifiable user records into the repository.
- Do not commit private photos, real health profiles, names, birth data, local usernames, secrets, API keys, or credentials.
- Use synthetic examples in tests and documentation.
- Treat posture and health notes as private runtime data stored outside git.

## Training Safety Rules

- This app is not medical diagnosis or treatment.
- The app must not encode or infer a real person's diagnosis or medical history in source control.
- Training recommendations should prioritize conservative progression, pain feedback, core stability, hip control, and avoiding aggressive loading when pain or fatigue is high.
- Red-flag symptoms must stop automatic training recommendations and prompt professional medical evaluation.
