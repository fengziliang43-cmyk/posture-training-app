# Posture Training App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working MVP of Liang's private posture-and-training app, then package it as an Android-installable APK after the PWA and Mac server pass local verification.

**Architecture:** Use a small TypeScript monorepo with shared rule logic in `src/core`, a Fastify API server in `src/server`, and a Vite React PWA in `src/web`. The Mac runs the server and stores SQLite data plus local posture photos; the OPPO phone accesses it through Tailscale, with Service Worker caching for offline task viewing and queued check-ins.

**Tech Stack:** Node.js, TypeScript, Fastify, SQLite, Vite, React, Vitest, Playwright/browser verification, Service Worker, Tailscale, Capacitor for the APK packaging step.

---

## File Structure

Create this structure during implementation:

```text
package.json
tsconfig.json
vite.config.ts
vitest.config.ts
index.html
public/
  manifest.webmanifest
  sw.js
src/
  core/
    types.ts
    exercise-library.ts
    training-templates.ts
    readiness.ts
    progression.ts
    weekly-schedule.ts
    plan-generator.ts
  server/
    app.ts
    index.ts
    config.ts
    db.ts
    migrations.ts
    auth.ts
    repositories.ts
    routes/
      auth.ts
      checkins.ts
      plans.ts
      workouts.ts
      photos.ts
      settings.ts
  web/
    main.tsx
    App.tsx
    api.ts
    offline.ts
    styles.css
    components/
      Layout.tsx
      StatusForm.tsx
      TodayPlan.tsx
      RecordsView.tsx
      PostureView.tsx
      SettingsView.tsx
tests/
  core/
    readiness.test.ts
    progression.test.ts
    plan-generator.test.ts
  server/
    auth.test.ts
    api.test.ts
docs/
  setup/
    tailscale.md
    android-apk.md
data/
  .gitkeep
uploads/
  .gitkeep
```

`data/` stores SQLite files at runtime and stays untracked except `.gitkeep`. `uploads/` stores posture photos at runtime and stays untracked except `.gitkeep`.

## Task 1: Update Project Rules And Scaffold The Node App

**Files:**
- Modify: `AGENTS.md`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `data/.gitkeep`
- Create: `uploads/.gitkeep`
- Modify: `.gitignore`

- [ ] **Step 1: Confirm project phase allows implementation**

Check:

```bash
sed -n '1,120p' AGENTS.md
```

Expected: `Current Phase` says implementation planning or implementation is allowed after plan approval.

- [ ] **Step 2: Create package manifest**

Create `package.json` with:

```json
{
  "name": "posture-training-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev:web": "vite --host 0.0.0.0 --port 5173",
    "dev:server": "tsx src/server/index.ts",
    "build": "tsc --noEmit && vite build",
    "start": "tsx src/server/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@fastify/cookie": "^11.0.0",
    "@fastify/multipart": "^9.0.0",
    "@fastify/static": "^8.0.0",
    "bcryptjs": "^2.4.3",
    "fastify": "^5.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "sqlite": "^5.1.1",
    "sqlite3": "^5.1.7",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "@vitejs/plugin-react": "^4.3.4",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vite": "^6.0.5",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 3: Create TypeScript and build config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787"
    }
  },
  build: {
    outDir: "dist/web"
  }
});
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"]
  }
});
```

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#f6c453" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <title>锻体修容</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/web/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Update gitignore for private runtime data**

Ensure `.gitignore` contains:

```gitignore
.superpowers/
node_modules/
dist/
.env
*.log
data/*.sqlite
data/*.sqlite-*
uploads/*
!uploads/.gitkeep
```

- [ ] **Step 5: Install local dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and dependencies install locally. This is a local project install, not a global dependency install.

- [ ] **Step 6: Verify scaffold files**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8')); console.log('package.json ok')"
npm test -- --passWithNoTests
```

Expected: `package.json ok` is printed, and Vitest exits successfully even though no tests exist yet. TypeScript linting starts after the first source files are added in Task 2.

- [ ] **Step 7: Commit scaffold**

```bash
git add AGENTS.md .gitignore package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts index.html data/.gitkeep uploads/.gitkeep
git commit -m "chore: scaffold posture training app"
```

## Task 2: Define Shared Domain Types, Exercise Library, And Templates

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/exercise-library.ts`
- Create: `src/core/training-templates.ts`
- Test: `tests/core/plan-generator.test.ts`

- [ ] **Step 1: Write initial template coverage test**

Create `tests/core/plan-generator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { exerciseLibrary } from "../../src/core/exercise-library";
import { trainingTemplates } from "../../src/core/training-templates";

describe("training templates", () => {
  it("uses only exercises present in the library", () => {
    const libraryIds = new Set(exerciseLibrary.map((exercise) => exercise.id));
    const missing = trainingTemplates.flatMap((template) =>
      template.blocks
        .flatMap((block) => block.exerciseIds)
        .filter((id) => !libraryIds.has(id))
    );

    expect(missing).toEqual([]);
  });

  it("includes the four v1 templates from the spec", () => {
    expect(trainingTemplates.map((template) => template.id)).toEqual([
      "upper-back-core",
      "glute-pelvis",
      "full-body-light",
      "recovery"
    ]);
  });
});
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```bash
npm test -- tests/core/plan-generator.test.ts
```

Expected: FAIL because `src/core/exercise-library.ts` and `src/core/training-templates.ts` do not exist yet.

- [ ] **Step 3: Create domain types**

Create `src/core/types.ts` with:

```ts
export type PainScore = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type EnergyScore = 1 | 2 | 3 | 4 | 5;
export type PlanType = "full" | "reduced" | "recovery";
export type TimeVersion = "compressed" | "short" | "full";
export type ExerciseCategory = "pull" | "scapula" | "core" | "hips" | "recovery";

export interface DailyStatus {
  date: string;
  lowBackPain: PainScore;
  neckShoulderPain?: PainScore;
  energy: EnergyScore;
  availableMinutes: number;
  sleepHours?: number;
  sleepQuality?: EnergyScore;
  steps?: number;
  eatingStatus?: "poor" | "normal" | "good";
  weightKg?: number;
  redFlags?: {
    legNumbness?: boolean;
    radiatingPain?: boolean;
    weakness?: boolean;
    bowelBladderChange?: boolean;
    sharpSuddenPain?: boolean;
  };
}

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  defaultSets: number;
  defaultReps?: number;
  defaultSeconds?: number;
  restSeconds: number;
  coachingNotes: string[];
  replacementId?: string;
  stopCondition: string;
}

export interface TemplateBlock {
  label: string;
  exerciseIds: string[];
}

export interface TrainingTemplate {
  id: "upper-back-core" | "glute-pelvis" | "full-body-light" | "recovery";
  name: string;
  type: PlanType;
  blocks: TemplateBlock[];
}

export interface GeneratedExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps?: number;
  seconds?: number;
  restSeconds: number;
  notes: string[];
  replacementId?: string;
  stopCondition: string;
}

export interface GeneratedPlan {
  date: string;
  type: PlanType;
  timeVersion: TimeVersion;
  templateId: TrainingTemplate["id"];
  reason: string;
  exercises: GeneratedExercise[];
  safetyMessage?: string;
}
```

- [ ] **Step 4: Create exercise library**

Create `src/core/exercise-library.ts` with every v1 exercise from the spec. Each entry must include `id`, `name`, `category`, default volume, rest, coaching notes, replacement, and stop condition.

Use these ids:

```ts
export const exerciseLibrary = [
  "pull-up",
  "band-lat-pulldown",
  "band-row",
  "band-face-pull",
  "band-external-rotation",
  "prone-ytw",
  "dead-bug",
  "bird-dog",
  "side-plank",
  "front-plank",
  "pallof-press",
  "glute-bridge",
  "single-leg-bridge-regressed",
  "split-squat",
  "step-up",
  "band-lateral-walk",
  "wall-sit",
  "thoracic-extension",
  "hip-flexor-stretch",
  "child-pose-breathing",
  "ninety-ninety-breathing",
  "brisk-walk"
];
```

The implementation should export full `Exercise[]`, not just string ids.

- [ ] **Step 5: Create training templates**

Create `src/core/training-templates.ts` with exactly four templates:

```ts
export const trainingTemplates = [
  {
    id: "upper-back-core",
    name: "上背 + 核心",
    type: "full",
    blocks: [
      { label: "热身", exerciseIds: ["thoracic-extension", "prone-ytw"] },
      { label: "主训练", exerciseIds: ["pull-up", "band-row"] },
      { label: "辅助", exerciseIds: ["band-face-pull"] },
      { label: "核心", exerciseIds: ["dead-bug"] },
      { label: "结束", exerciseIds: ["ninety-ninety-breathing"] }
    ]
  },
  {
    id: "glute-pelvis",
    name: "臀腿 + 骨盆稳定",
    type: "full",
    blocks: [
      { label: "热身", exerciseIds: ["hip-flexor-stretch", "glute-bridge"] },
      { label: "主训练", exerciseIds: ["split-squat", "glute-bridge"] },
      { label: "辅助", exerciseIds: ["band-lateral-walk"] },
      { label: "核心", exerciseIds: ["side-plank"] },
      { label: "结束", exerciseIds: ["brisk-walk"] }
    ]
  },
  {
    id: "full-body-light",
    name: "全身轻量",
    type: "reduced",
    blocks: [
      { label: "拉力", exerciseIds: ["pull-up", "band-row"] },
      { label: "下肢", exerciseIds: ["split-squat"] },
      { label: "核心", exerciseIds: ["dead-bug", "bird-dog"] }
    ]
  },
  {
    id: "recovery",
    name: "恢复日",
    type: "recovery",
    blocks: [
      { label: "低强度活动", exerciseIds: ["brisk-walk"] },
      { label: "呼吸和活动度", exerciseIds: ["ninety-ninety-breathing", "bird-dog", "child-pose-breathing", "thoracic-extension"] }
    ]
  }
] satisfies TrainingTemplate[];
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- tests/core/plan-generator.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit domain library**

```bash
git add src/core/types.ts src/core/exercise-library.ts src/core/training-templates.ts tests/core/plan-generator.test.ts
git commit -m "feat: add training domain library"
```

## Task 3: Implement Readiness Decision Tree

**Files:**
- Create: `src/core/readiness.ts`
- Test: `tests/core/readiness.test.ts`

- [ ] **Step 1: Write readiness tests**

Create `tests/core/readiness.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { evaluateReadiness } from "../../src/core/readiness";
import type { DailyStatus } from "../../src/core/types";

const baseStatus: DailyStatus = {
  date: "2026-06-11",
  lowBackPain: 2,
  energy: 4,
  availableMinutes: 45,
  sleepHours: 7,
  sleepQuality: 4
};

describe("evaluateReadiness", () => {
  it("blocks training when a red flag is present", () => {
    const result = evaluateReadiness({
      ...baseStatus,
      redFlags: { radiatingPain: true }
    });

    expect(result.blocked).toBe(true);
    expect(result.planType).toBe("recovery");
    expect(result.reason).toContain("红旗");
  });

  it("uses recovery when low back pain is 6 or higher", () => {
    const result = evaluateReadiness({ ...baseStatus, lowBackPain: 6 });
    expect(result.planType).toBe("recovery");
    expect(result.timeVersion).toBe("short");
  });

  it("uses reduced training for moderate low back pain", () => {
    const result = evaluateReadiness({ ...baseStatus, lowBackPain: 4 });
    expect(result.planType).toBe("reduced");
  });

  it("uses recovery for poor sleep and low energy", () => {
    const result = evaluateReadiness({
      ...baseStatus,
      lowBackPain: 4,
      energy: 1,
      sleepHours: 5
    });
    expect(result.planType).toBe("recovery");
  });

  it("compresses time when available minutes are under 20", () => {
    const result = evaluateReadiness({
      ...baseStatus,
      availableMinutes: 15
    });
    expect(result.planType).toBe("full");
    expect(result.timeVersion).toBe("compressed");
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
npm test -- tests/core/readiness.test.ts
```

Expected: FAIL because `src/core/readiness.ts` does not exist yet.

- [ ] **Step 3: Implement readiness tree**

Create `src/core/readiness.ts`:

```ts
import type { DailyStatus, PlanType, TimeVersion } from "./types";

export interface ReadinessResult {
  planType: PlanType;
  timeVersion: TimeVersion;
  blocked: boolean;
  reason: string;
}

export function evaluateReadiness(status: DailyStatus): ReadinessResult {
  if (hasRedFlag(status)) {
    return {
      planType: "recovery",
      timeVersion: "short",
      blocked: true,
      reason: "出现红旗症状，今天不生成训练任务，先暂停训练并考虑就医评估。"
    };
  }

  const timeVersion = getTimeVersion(status.availableMinutes);

  if (status.lowBackPain >= 6) {
    return {
      planType: "recovery",
      timeVersion,
      blocked: false,
      reason: "腰酸达到 6/10 或以上，今天优先恢复和低强度活动。"
    };
  }

  if ((status.energy <= 1 && (status.sleepHours ?? 7) <= 5) || status.sleepQuality === 1) {
    return {
      planType: "recovery",
      timeVersion,
      blocked: false,
      reason: "睡眠和精神状态都偏低，今天不硬扛，改恢复版。"
    };
  }

  if (status.lowBackPain >= 4 || status.energy <= 3 || (status.sleepHours !== undefined && status.sleepHours < 6)) {
    return {
      planType: "reduced",
      timeVersion,
      blocked: false,
      reason: "状态一般，保留训练框架，但降低腰部压力和总量。"
    };
  }

  return {
    planType: "full",
    timeVersion,
    blocked: false,
    reason: "状态稳定，安排完整训练。"
  };
}

function hasRedFlag(status: DailyStatus): boolean {
  const flags = status.redFlags;
  return Boolean(
    flags?.legNumbness ||
      flags?.radiatingPain ||
      flags?.weakness ||
      flags?.bowelBladderChange ||
      flags?.sharpSuddenPain
  );
}

function getTimeVersion(minutes: number): TimeVersion {
  if (minutes < 20) return "compressed";
  if (minutes < 40) return "short";
  return "full";
}
```

- [ ] **Step 4: Run readiness tests**

Run:

```bash
npm test -- tests/core/readiness.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit readiness engine**

```bash
git add src/core/readiness.ts tests/core/readiness.test.ts
git commit -m "feat: add readiness decision tree"
```

## Task 4: Implement Progression And Deload Rules

**Files:**
- Create: `src/core/progression.ts`
- Test: `tests/core/progression.test.ts`

- [ ] **Step 1: Write progression tests**

Create `tests/core/progression.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getProgressionAdjustment } from "../../src/core/progression";

describe("getProgressionAdjustment", () => {
  it("adds reps after two stable completed weeks", () => {
    const result = getProgressionAdjustment({
      exerciseId: "band-row",
      completedStableWeeks: 2,
      currentWeekInCycle: 2,
      lowBackPainMaxThisWeek: 3,
      currentReps: 12,
      currentSeconds: undefined,
      currentSets: 3
    });

    expect(result.reps).toBe(14);
    expect(result.reason).toContain("连续 2 周");
  });

  it("does not progress when low back pain is high", () => {
    const result = getProgressionAdjustment({
      exerciseId: "dead-bug",
      completedStableWeeks: 3,
      currentWeekInCycle: 3,
      lowBackPainMaxThisWeek: 5,
      currentReps: undefined,
      currentSeconds: 30,
      currentSets: 3
    });

    expect(result.seconds).toBe(30);
    expect(result.reason).toContain("不进阶");
  });

  it("deloads on week five", () => {
    const result = getProgressionAdjustment({
      exerciseId: "pull-up",
      completedStableWeeks: 4,
      currentWeekInCycle: 5,
      lowBackPainMaxThisWeek: 2,
      currentReps: 5,
      currentSeconds: undefined,
      currentSets: 3
    });

    expect(result.sets).toBe(2);
    expect(result.reason).toContain("减载");
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
npm test -- tests/core/progression.test.ts
```

Expected: FAIL because `src/core/progression.ts` does not exist yet.

- [ ] **Step 3: Implement progression**

Create `src/core/progression.ts`:

```ts
export interface ProgressionInput {
  exerciseId: string;
  completedStableWeeks: number;
  currentWeekInCycle: number;
  lowBackPainMaxThisWeek: number;
  currentReps?: number;
  currentSeconds?: number;
  currentSets: number;
}

export interface ProgressionAdjustment {
  reps?: number;
  seconds?: number;
  sets: number;
  reason: string;
}

export function getProgressionAdjustment(input: ProgressionInput): ProgressionAdjustment {
  if (input.currentWeekInCycle === 5) {
    return {
      reps: input.currentReps,
      seconds: input.currentSeconds,
      sets: Math.max(1, Math.floor(input.currentSets * 0.7)),
      reason: "第 5 周自动减载，总量降低 20%-30%。"
    };
  }

  if (input.lowBackPainMaxThisWeek >= 5) {
    return {
      reps: input.currentReps,
      seconds: input.currentSeconds,
      sets: input.currentSets,
      reason: "本周腰酸偏高，不进阶。"
    };
  }

  if (input.completedStableWeeks < 2) {
    return {
      reps: input.currentReps,
      seconds: input.currentSeconds,
      sets: input.currentSets,
      reason: "稳定完成未满 2 周，保持当前难度。"
    };
  }

  if (input.currentSeconds !== undefined) {
    return {
      seconds: input.currentSeconds + 5,
      reps: input.currentReps,
      sets: input.currentSets,
      reason: "连续 2 周稳定完成，核心动作增加 5 秒。"
    };
  }

  if (input.currentReps !== undefined) {
    return {
      reps: input.currentReps + 2,
      seconds: input.currentSeconds,
      sets: input.currentSets,
      reason: "连续 2 周稳定完成，动作增加 2 次。"
    };
  }

  return {
    reps: input.currentReps,
    seconds: input.currentSeconds,
    sets: input.currentSets + 1,
    reason: "连续 2 周稳定完成，增加 1 组。"
  };
}
```

- [ ] **Step 4: Run progression tests**

Run:

```bash
npm test -- tests/core/progression.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit progression**

```bash
git add src/core/progression.ts tests/core/progression.test.ts
git commit -m "feat: add progression rules"
```

## Task 5: Generate Plans From Templates

**Files:**
- Create: `src/core/weekly-schedule.ts`
- Create: `src/core/plan-generator.ts`
- Modify: `tests/core/plan-generator.test.ts`

- [ ] **Step 1: Extend plan-generator tests**

Append tests to `tests/core/plan-generator.test.ts`:

```ts
import { generateDailyPlan } from "../../src/core/plan-generator";

describe("generateDailyPlan", () => {
  it("returns recovery template for high low back pain", () => {
    const plan = generateDailyPlan({
      status: {
        date: "2026-06-11",
        lowBackPain: 7,
        energy: 3,
        availableMinutes: 45
      },
      completedMainSessionsThisWeek: 0,
      lastTemplateId: undefined
    });

    expect(plan.type).toBe("recovery");
    expect(plan.templateId).toBe("recovery");
  });

  it("returns compressed full plan when time is short but readiness is good", () => {
    const plan = generateDailyPlan({
      status: {
        date: "2026-06-11",
        lowBackPain: 2,
        energy: 5,
        availableMinutes: 15
      },
      completedMainSessionsThisWeek: 0,
      lastTemplateId: "glute-pelvis"
    });

    expect(plan.type).toBe("full");
    expect(plan.timeVersion).toBe("compressed");
    expect(plan.exercises.length).toBeGreaterThan(0);
  });

  it("uses recovery when three main sessions are already complete", () => {
    const plan = generateDailyPlan({
      status: {
        date: "2026-06-11",
        lowBackPain: 1,
        energy: 5,
        availableMinutes: 60
      },
      completedMainSessionsThisWeek: 3,
      lastTemplateId: "upper-back-core"
    });

    expect(plan.type).toBe("recovery");
    expect(plan.reason).toContain("本周已完成");
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
npm test -- tests/core/plan-generator.test.ts
```

Expected: FAIL because `generateDailyPlan` is not implemented.

- [ ] **Step 3: Implement weekly schedule helper**

Create `src/core/weekly-schedule.ts`:

```ts
import type { TrainingTemplate } from "./types";

const mainTemplates: TrainingTemplate["id"][] = ["upper-back-core", "glute-pelvis"];

export function chooseNextMainTemplate(lastTemplateId?: TrainingTemplate["id"]): TrainingTemplate["id"] {
  if (lastTemplateId === "upper-back-core") return "glute-pelvis";
  return "upper-back-core";
}

export function shouldPreferRecovery(completedMainSessionsThisWeek: number): boolean {
  return completedMainSessionsThisWeek >= 3;
}

export function isMainTemplate(templateId: TrainingTemplate["id"]): boolean {
  return mainTemplates.includes(templateId);
}
```

- [ ] **Step 4: Implement plan generator**

Create `src/core/plan-generator.ts` to:

- call `evaluateReadiness`
- choose `recovery` when blocked, recovery, or weekly quota complete
- choose `full-body-light` for reduced plans
- rotate between `upper-back-core` and `glute-pelvis` for full plans
- convert template exercise ids into full `GeneratedExercise[]`
- reduce exercise list for `compressed` time version

Expected exported function signature:

```ts
export function generateDailyPlan(input: {
  status: DailyStatus;
  completedMainSessionsThisWeek: number;
  lastTemplateId?: TrainingTemplate["id"];
}): GeneratedPlan
```

- [ ] **Step 5: Run core tests**

Run:

```bash
npm test -- tests/core
```

Expected: all core tests PASS.

- [ ] **Step 6: Commit plan generator**

```bash
git add src/core/weekly-schedule.ts src/core/plan-generator.ts tests/core/plan-generator.test.ts
git commit -m "feat: generate daily training plans"
```

## Task 6: Build SQLite Persistence And Server App

**Files:**
- Create: `src/server/config.ts`
- Create: `src/server/db.ts`
- Create: `src/server/migrations.ts`
- Create: `src/server/repositories.ts`
- Create: `src/server/app.ts`
- Create: `src/server/index.ts`
- Test: `tests/server/api.test.ts`

- [ ] **Step 1: Write server smoke test**

Create `tests/server/api.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/app";

describe("server app", () => {
  it("responds to health check", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });
    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    await app.close();
  });
});
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```bash
npm test -- tests/server/api.test.ts
```

Expected: FAIL because server app does not exist yet.

- [ ] **Step 3: Implement config and database**

Create config files:

```ts
// src/server/config.ts
export interface ServerConfig {
  port: number;
  host: string;
  databaseFile: string;
  uploadDir: string;
  cookieSecret: string;
}

export function loadConfig(): ServerConfig {
  return {
    port: Number(process.env.PORT ?? 8787),
    host: process.env.HOST ?? "0.0.0.0",
    databaseFile: process.env.DATABASE_FILE ?? "data/app.sqlite",
    uploadDir: process.env.UPLOAD_DIR ?? "uploads",
    cookieSecret: process.env.COOKIE_SECRET ?? "local-dev-change-me"
  };
}
```

`src/server/migrations.ts` must create tables:

- `users`
- `checkins`
- `plans`
- `workout_logs`
- `posture_photos`
- `settings`

`src/server/db.ts` must open SQLite and run migrations on startup.

- [ ] **Step 4: Implement Fastify app**

`src/server/app.ts` must:

- create Fastify instance
- register cookie, multipart, and static serving
- expose `GET /api/health`
- call route registration functions

`src/server/index.ts` must load config and start the server.

- [ ] **Step 5: Run server smoke test**

Run:

```bash
npm test -- tests/server/api.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit server foundation**

```bash
git add src/server tests/server/api.test.ts
git commit -m "feat: add server foundation"
```

## Task 7: Add Local Auth With Hashed Passwords

**Files:**
- Create: `src/server/auth.ts`
- Create: `src/server/routes/auth.ts`
- Modify: `src/server/app.ts`
- Test: `tests/server/auth.test.ts`

- [ ] **Step 1: Write auth tests**

Create `tests/server/auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/app";

describe("auth", () => {
  it("creates a local user and logs in without storing plaintext password", async () => {
    const app = await buildApp({ databaseFile: ":memory:", uploadDir: "uploads-test" });

    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { username: "liang", password: "test-password-123" }
    });
    expect(setup.statusCode).toBe(200);

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "liang", password: "test-password-123" }
    });
    expect(login.statusCode).toBe(200);
    expect(login.headers["set-cookie"]).toBeTruthy();

    await app.close();
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
npm test -- tests/server/auth.test.ts
```

Expected: FAIL because auth routes do not exist yet.

- [ ] **Step 3: Implement auth**

Implement `src/server/auth.ts` with:

- `hashPassword(password: string): Promise<string>` using `bcryptjs.hash(password, 12)`
- `verifyPassword(password: string, hash: string): Promise<boolean>`
- `createSessionToken(): string`

Implement `src/server/routes/auth.ts`:

- `POST /api/auth/setup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Only allow setup when no user exists.

- [ ] **Step 4: Run auth tests**

Run:

```bash
npm test -- tests/server/auth.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit auth**

```bash
git add src/server/auth.ts src/server/routes/auth.ts src/server/app.ts tests/server/auth.test.ts
git commit -m "feat: add local authentication"
```

## Task 8: Add Check-In, Plan, Workout, Photo, And Settings APIs

**Files:**
- Create: `src/server/routes/checkins.ts`
- Create: `src/server/routes/plans.ts`
- Create: `src/server/routes/workouts.ts`
- Create: `src/server/routes/photos.ts`
- Create: `src/server/routes/settings.ts`
- Modify: `src/server/app.ts`
- Modify: `src/server/repositories.ts`
- Test: `tests/server/api.test.ts`

- [ ] **Step 1: Extend API tests**

Add tests that cover:

- creating a check-in
- generating today plan
- logging workout completion
- listing records
- uploading photo metadata with a fake file
- reading settings

Use Fastify `inject` and authenticated cookies from `/api/auth/login`.

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
npm test -- tests/server/api.test.ts
```

Expected: FAIL because routes are missing.

- [ ] **Step 3: Implement routes**

Implement these endpoints:

```text
POST /api/checkins
GET /api/checkins/recent
POST /api/plans/today
GET /api/plans/today
POST /api/workouts/:planId/complete
GET /api/records/summary
POST /api/photos
GET /api/photos
GET /api/photos/:id/file
GET /api/settings
PUT /api/settings
```

All routes except setup/login must require authentication.

- [ ] **Step 4: Run server tests**

Run:

```bash
npm test -- tests/server
```

Expected: all server tests PASS.

- [ ] **Step 5: Commit APIs**

```bash
git add src/server/routes src/server/repositories.ts src/server/app.ts tests/server/api.test.ts
git commit -m "feat: add training app api"
```

## Task 9: Build Mobile-First PWA Shell

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `src/web/main.tsx`
- Create: `src/web/App.tsx`
- Create: `src/web/styles.css`
- Create: `src/web/components/Layout.tsx`
- Create: `src/web/api.ts`

- [ ] **Step 1: Create manifest**

Create `public/manifest.webmanifest`:

```json
{
  "name": "锻体修容",
  "short_name": "锻体",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#fff9ea",
  "theme_color": "#f6c453",
  "icons": []
}
```

- [ ] **Step 2: Create React entry**

`src/web/main.tsx` must render `App` and register `public/sw.js` when available.

- [ ] **Step 3: Create app shell**

`src/web/App.tsx` must:

- maintain active tab: `today`, `records`, `posture`, `settings`
- render bottom nav labels `今日 / 记录 / 体态 / 设置`
- show login/setup screen when unauthenticated

`src/web/styles.css` must use the approved warm yellow, single-column card direction.

- [ ] **Step 4: Build check**

Run:

```bash
npm run build
```

Expected: Vite build succeeds and creates `dist/web`.

- [ ] **Step 5: Commit PWA shell**

```bash
git add public/manifest.webmanifest src/web/main.tsx src/web/App.tsx src/web/styles.css src/web/components/Layout.tsx src/web/api.ts
git commit -m "feat: add mobile pwa shell"
```

## Task 10: Build Today Page With Status Form And Generated Plan

**Files:**
- Create: `src/web/components/StatusForm.tsx`
- Create: `src/web/components/TodayPlan.tsx`
- Modify: `src/web/App.tsx`
- Modify: `src/web/api.ts`

- [ ] **Step 1: Build status form**

`StatusForm.tsx` must show:

- required sliders or segmented controls for low back pain, energy, available minutes
- collapsed advanced section for neck/shoulder pain, sleep, steps, eating status, optional weight
- red flag checklist
- submit button labeled `生成今天任务`

- [ ] **Step 2: Build today plan card**

`TodayPlan.tsx` must show:

- plan type
- reason
- exercise list
- sets/reps/time/rest
- coaching notes
- replacement exercise
- stop condition
- complete button per exercise
- finish workout button

- [ ] **Step 3: Connect API**

On submit:

1. `POST /api/checkins`
2. `POST /api/plans/today`
3. render returned plan

- [ ] **Step 4: Build and inspect**

Run:

```bash
npm run build
```

Expected: build succeeds.

Start dev servers and inspect on mobile width:

```bash
npm run dev:server
npm run dev:web
```

Expected: Today page is usable at `http://localhost:5173`.

- [ ] **Step 5: Commit Today page**

```bash
git add src/web/components/StatusForm.tsx src/web/components/TodayPlan.tsx src/web/App.tsx src/web/api.ts
git commit -m "feat: add today training flow"
```

## Task 11: Build Records, Posture, And Settings Screens

**Files:**
- Create: `src/web/components/RecordsView.tsx`
- Create: `src/web/components/PostureView.tsx`
- Create: `src/web/components/SettingsView.tsx`
- Modify: `src/web/App.tsx`
- Modify: `src/web/api.ts`

- [ ] **Step 1: Build Records screen**

Show:

- recent low back pain trend
- sleep trend
- energy trend
- optional weight trend
- weekly training count
- progression records

Use simple CSS charts first: bars and line-like rows are enough for v1.

- [ ] **Step 2: Build Posture screen**

Support:

- upload front, side, back photo
- list weekly sets
- side-by-side comparison for same angle
- left/right slider interaction if two same-angle images are selected

- [ ] **Step 3: Build Settings screen**

Show:

- account status
- server URL
- Tailscale guidance
- notification toggle
- DeepSeek disabled state

- [ ] **Step 4: Build and inspect**

Run:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit screens**

```bash
git add src/web/components/RecordsView.tsx src/web/components/PostureView.tsx src/web/components/SettingsView.tsx src/web/App.tsx src/web/api.ts
git commit -m "feat: add records posture and settings screens"
```

## Task 12: Add Offline Cache And Sync Queue

**Files:**
- Create: `public/sw.js`
- Create: `src/web/offline.ts`
- Modify: `src/web/api.ts`
- Modify: `src/web/main.tsx`

- [ ] **Step 1: Implement service worker**

`public/sw.js` must:

- cache app shell files
- cache the latest `GET /api/plans/today` response
- serve cached app shell when offline

- [ ] **Step 2: Implement client queue**

`src/web/offline.ts` must:

- store offline workout completions in `localStorage`
- expose `queueOfflineAction(action)`
- expose `flushOfflineActions(apiClient)`
- flush on app startup and when browser returns online

- [ ] **Step 3: Wire offline behavior**

`api.ts` must:

- fall back to cached today plan if plan fetch fails
- queue workout completion if offline
- show user-facing offline state

- [ ] **Step 4: Manual verification**

Run:

```bash
npm run build
npm run dev:server
npm run dev:web
```

In browser devtools or Playwright, simulate offline after loading today plan.

Expected:

- app shell still loads
- today plan is visible
- workout completion can be queued
- queued action syncs after returning online

- [ ] **Step 5: Commit offline support**

```bash
git add public/sw.js src/web/offline.ts src/web/api.ts src/web/main.tsx
git commit -m "feat: add offline plan cache"
```

## Task 13: Add Setup Docs For Tailscale And Local Server

**Files:**
- Create: `docs/setup/tailscale.md`
- Modify: `README.md`

- [ ] **Step 1: Write Tailscale setup doc**

Create `docs/setup/tailscale.md` with:

```md
# Tailscale Setup

1. Install Tailscale on the Mac.
2. Install Tailscale on the OPPO phone.
3. Log in to the same Tailscale account on both devices.
4. Start the Mac server with `npm run dev:server`.
5. Open the Mac Tailscale IP plus the server port from the phone.
6. Keep the Mac awake during training if the phone needs live sync.

Do not expose this app directly to the public internet in v1.
```

- [ ] **Step 2: Write project README**

Create or update `README.md` with:

- what the app is
- how to install local dependencies
- how to run server and web dev mode
- where data is stored
- privacy warning about photos
- where the design spec and implementation plan live

- [ ] **Step 3: Commit setup docs**

```bash
git add README.md docs/setup/tailscale.md
git commit -m "docs: add local setup guide"
```

## Task 14: Verify MVP End To End

**Files:**
- No new files unless fixing defects found during verification.

- [ ] **Step 1: Run automated tests**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and build succeeds.

- [ ] **Step 2: Start app**

Run server:

```bash
npm run dev:server
```

Run web app in another terminal:

```bash
npm run dev:web
```

- [ ] **Step 3: Verify flows in browser**

Use the in-app browser or a local browser to verify:

- first account setup
- login
- daily status form
- full plan generation
- reduced plan generation
- recovery plan generation
- workout completion
- records screen
- photo upload and comparison
- settings screen
- offline plan viewing

- [ ] **Step 4: Verify mobile viewport**

Use a mobile-sized viewport around `390x844`.

Expected:

- no horizontal scrolling
- bottom nav visible
- status form controls large enough to tap
- task card readable
- posture upload usable

- [ ] **Step 5: Commit final MVP fixes**

Commit any fixes with focused messages:

```bash
git add <changed-files>
git commit -m "fix: polish mvp verification issues"
```

## Task 15: Package Android APK After PWA Passes

**Files:**
- Create: `capacitor.config.ts`
- Create or update: `docs/setup/android-apk.md`
- Generated: `android/`

- [ ] **Step 1: Add local Capacitor dependencies**

Run:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android --save-dev
```

Expected: dependencies install locally and `package-lock.json` updates.

- [ ] **Step 2: Create Capacitor config**

Create `capacitor.config.ts`:

```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "local.liang.posturetraining",
  appName: "锻体修容",
  webDir: "dist/web",
  server: {
    androidScheme: "https"
  }
};

export default config;
```

- [ ] **Step 3: Initialize Android project**

Run:

```bash
npm run build
npx cap add android
npx cap copy android
```

Expected: `android/` project is generated.

- [ ] **Step 4: Build debug APK**

Run:

```bash
cd android
./gradlew assembleDebug
```

Expected: debug APK exists under:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

- [ ] **Step 5: Write APK setup doc**

Create `docs/setup/android-apk.md` with:

- APK build command
- APK output path
- OPPO installation steps
- warning that the Mac server must still be reachable through Tailscale for sync
- note that a production release APK needs a release signing key

- [ ] **Step 6: Commit APK packaging**

```bash
git add package.json package-lock.json capacitor.config.ts android docs/setup/android-apk.md
git commit -m "build: add android apk packaging"
```

## Task 16: Final Delivery Checklist

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README with final commands**

README must include:

```bash
npm install
npm test
npm run build
npm run dev:server
npm run dev:web
```

And APK path:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

- [ ] **Step 2: Run final verification**

Run:

```bash
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 3: Confirm no private photos or data are tracked**

Run:

```bash
git status --short
git ls-files uploads data
```

Expected: only `.gitkeep` files are tracked under `uploads/` and `data/`.

- [ ] **Step 4: Commit final docs**

```bash
git add README.md
git commit -m "docs: finalize delivery instructions"
```

## Plan Self-Review

Coverage:

- Daily status input: Task 10.
- Readiness decision tree: Task 3.
- Training templates and action library: Tasks 2 and 5.
- Progression and deload: Task 4.
- Mac server and SQLite: Task 6.
- Hashed password auth: Task 7.
- Photos and settings: Tasks 8 and 11.
- Offline cache: Task 12.
- Tailscale setup: Task 13.
- APK packaging: Task 15.

Execution rule:

- Do not begin Task 1 implementation until Liang approves this plan.
- Do not push to remote.
- Do not store body photos, tokens, API keys, or private runtime data in git.
