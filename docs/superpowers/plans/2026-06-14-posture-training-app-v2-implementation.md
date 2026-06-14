# Posture Training App V2 Implementation Plan

> **For agentic workers:** Implement this plan task by task. Do not add application code before this V2 plan is reviewed and approved by Liang. Keep API keys, tokens, photos, SQLite runtime data, and private health data out of git and docs.

**Goal:** Add V2 features on top of the working MVP: DeepSeek configuration and safe AI explanations, weekly review, action replacement, improved posture photo comparison, and local backup export.

**Safety Principle:** The local rules engine remains the source of truth for training decisions. DeepSeek can explain and summarize only; it must not choose exercises, modify volume, override red flags, or analyze posture photos.

**Main Spec:** `docs/superpowers/specs/2026-06-14-posture-training-app-v2-design.md`

---

## Phase 0: Approval And Baseline

**Files:**
- Read: `AGENTS.md`
- Read: `README.md`
- Read: `docs/superpowers/specs/2026-06-14-posture-training-app-v2-design.md`
- Read: this plan

- [ ] **Step 1: Confirm approval**

Before code changes, confirm Liang has approved this V2 plan.

- [ ] **Step 2: Check working tree**

Run:

```bash
git status --short
```

Expected: understand existing V1 changes. Do not revert user or prior Codex changes.

- [ ] **Step 3: Baseline verification**

Run:

```bash
PATH="/Users/liang/.openclaw/tools/node-v22.22.0/bin:$PATH" npm run lint
PATH="/Users/liang/.openclaw/tools/node-v22.22.0/bin:$PATH" npm test
```

Expected: baseline passes before V2 code starts.

## Phase 1: DeepSeek Settings And Secret Safety

**Goal:** Let Liang store and test a DeepSeek API key locally without exposing it in APK, git, docs, or logs.

**Files likely touched:**
- `src/server/repositories.ts`
- `src/server/routes/settings.ts`
- `src/server/app.ts`
- `src/web/api.ts`
- `src/web/components/SettingsView.tsx`
- `tests/server/api.test.ts`
- `tests/server/settings.test.ts` if split out

- [ ] **Step 1: Define settings shape**

Add settings fields:

```ts
deepseekEnabled: boolean;
deepseekApiKeyConfigured: boolean;
deepseekModel?: string;
deepseekLastTestAt?: string;
deepseekLastTestOk?: boolean;
```

Do not return the full API key from any API response.

- [ ] **Step 2: Add write-only API key update path**

Add server handling so the frontend can submit a new key, but `GET /api/settings` only returns:

```json
{
  "deepseekApiKeyConfigured": true
}
```

Never echo the key.

- [ ] **Step 3: Add clear-key path**

Support clearing the stored DeepSeek key.

Expected UI behavior:

- when key exists: show “已配置”
- when cleared: show “未配置”

- [ ] **Step 4: Add tests for no secret leakage**

Test:

- saving key returns no key
- fetching settings returns no key
- clearing key works
- invalid body does not store key

Use fake key values in tests only.

- [ ] **Step 5: Update Settings page**

Add:

- DeepSeek enable switch
- API key password input
- save key button
- clear key button
- configured/unconfigured status

Do not prefill the input with the saved key.

## Phase 2: DeepSeek Client And Connection Test

**Goal:** Test DeepSeek connectivity from Mac server only.

**Files likely touched:**
- `src/server/deepseek.ts`
- `src/server/routes/ai.ts`
- `src/server/app.ts`
- `src/web/api.ts`
- `src/web/components/SettingsView.tsx`
- `tests/server/deepseek.test.ts`

- [ ] **Step 1: Verify official DeepSeek API docs**

Before implementation, check current official DeepSeek docs for:

- base URL
- auth header
- model name
- chat completion request/response format

Use official docs only. Do not rely on stale memory.

- [ ] **Step 2: Create server-side client**

Create a small DeepSeek client that:

- receives API key from settings
- uses server-side fetch
- has a short timeout
- returns sanitized errors
- never logs key

- [ ] **Step 3: Add connection test endpoint**

Add authenticated endpoint:

```text
POST /api/ai/deepseek/test
```

It should send a minimal harmless prompt and return:

```json
{
  "ok": true,
  "checkedAt": "ISO date"
}
```

No prompt should include private health notes in this test.

- [ ] **Step 4: Add UI test button**

Settings page button:

```text
测试 DeepSeek 连接
```

Success: “DeepSeek 连接正常。”

Failure: “DeepSeek 暂不可用，本地规则仍正常。”

- [ ] **Step 5: Tests**

Mock fetch and verify:

- success path
- 401/invalid key path
- timeout path
- no key configured path
- no response leaks key

## Phase 3: Local Explanation First

**Goal:** Add deterministic local explanation before AI so the feature works without DeepSeek.

**Files likely touched:**
- `src/core/plan-explanation.ts`
- `src/core/plan-explanation.test.ts`
- `src/server/routes/plans.ts`
- `src/web/components/TodayPlan.tsx`
- `src/web/api.ts`

- [ ] **Step 1: Create local explanation function**

Input:

- generated plan
- daily status
- readiness reason

Output:

- plan type label
- reason bullets
- safety note

- [ ] **Step 2: Attach explanation to plan response**

Add `explanation` to the plan response without changing existing plan fields.

- [ ] **Step 3: Render in Today page**

Add a “今日解释” card under the plan reason.

Keep copy short and concrete.

- [ ] **Step 4: Tests**

Verify:

- high waist pain explanation mentions recovery
- low time explanation mentions compressed/short version
- red flag explanation stays conservative

## Phase 4: AI Daily Explanation

**Goal:** Let DeepSeek rewrite the local explanation in a short coach voice without changing the plan.

**Files likely touched:**
- `src/server/ai-prompts.ts`
- `src/server/routes/ai.ts`
- `src/web/api.ts`
- `src/web/components/TodayPlan.tsx`
- `tests/server/ai.test.ts`

- [ ] **Step 1: Add prompt builder**

Prompt must include:

- plan type
- local reason
- exercises names only
- safety constraints

Prompt must not include:

- API key
- posture photos
- raw private file paths
- unnecessary historical data

- [ ] **Step 2: Add endpoint**

```text
POST /api/ai/daily-explanation
```

Returns:

```json
{
  "explanation": "short Chinese text",
  "source": "deepseek"
}
```

Fallback returns local explanation with:

```json
{
  "source": "local"
}
```

- [ ] **Step 3: Enforce output limits**

Trim output to a safe length, for example 160 Chinese characters.

- [ ] **Step 4: UI**

Add button:

```text
生成 AI 解释
```

If no key is configured, show local explanation only.

- [ ] **Step 5: Tests**

Verify AI endpoint cannot alter plan fields.

## Phase 5: Weekly Review

**Goal:** Add a weekly review card in Records.

**Files likely touched:**
- `src/core/weekly-review.ts`
- `src/server/repositories.ts`
- `src/server/routes/records.ts`
- `src/web/components/RecordsView.tsx`
- `tests/core/weekly-review.test.ts`
- `tests/server/api.test.ts`

- [ ] **Step 1: Compute local weekly review**

Fields:

- week start/end
- completed workouts count
- average low back pain
- highest low back pain
- average sleep
- average energy
- recommendation: maintain/reduce/recover/eligible-for-progression

- [ ] **Step 2: Add to records summary API**

Extend `/api/records/summary`.

- [ ] **Step 3: Render local weekly review**

Records page card:

- 本周完成
- 腰酸趋势
- 睡眠和精神
- 下周建议

- [ ] **Step 4: Optional AI weekly summary**

Use DeepSeek only to rewrite computed facts.

Do not send photos.

- [ ] **Step 5: Tests**

Verify recommendation logic:

- high pain -> recover/reduce
- stable completed week -> maintain or eligible
- low completion -> reduce

## Phase 6: Action Replacement

**Goal:** Allow today’s plan to replace an exercise with its configured replacement.

**Files likely touched:**
- `src/server/migrations.ts`
- `src/server/repositories.ts`
- `src/server/routes/plans.ts`
- `src/web/components/TodayPlan.tsx`
- `tests/server/api.test.ts`

- [ ] **Step 1: Add replacement log storage**

Store:

- plan id
- original exercise id
- replacement exercise id
- replaced at

- [ ] **Step 2: Add endpoint**

```text
POST /api/plans/:planId/exercises/:exerciseId/replace
```

Only allow replacement when:

- plan belongs to authenticated user
- exercise exists in plan
- replacementId exists in local exercise library

- [ ] **Step 3: Update returned plan**

After replacement, returned plan should contain the replacement exercise details.

- [ ] **Step 4: UI**

Add button:

```text
换成替代动作
```

Show replacement success message.

- [ ] **Step 5: Tests**

Verify:

- valid replacement works
- unknown exercise fails
- replacement cannot introduce arbitrary exercise
- stop condition and rest time come from replacement exercise

## Phase 7: Posture Photo Comparison Enhancements

**Goal:** Improve manual comparison without AI analysis.

**Files likely touched:**
- `src/server/migrations.ts`
- `src/server/repositories.ts`
- `src/server/routes/photos.ts`
- `src/web/components/PostureView.tsx`
- `src/web/styles.css`
- `tests/server/api.test.ts`

- [ ] **Step 1: Add photo notes**

Allow optional short note per photo.

- [ ] **Step 2: Add comparison selectors**

UI should support:

- latest vs previous
- month first vs latest
- choose same angle

- [ ] **Step 3: Keep data local**

No photo upload to AI or third party.

- [ ] **Step 4: Tests**

Verify notes save and list with photos.

## Phase 8: Backup Export

**Goal:** Let Liang export local data safely.

**Files likely touched:**
- `src/server/routes/backup.ts`
- `src/server/app.ts`
- `src/web/components/SettingsView.tsx`
- `tests/server/backup.test.ts`

- [ ] **Step 1: Add backup endpoint**

Authenticated endpoint:

```text
GET /api/backup/export
```

Returns a zip containing:

- SQLite database copy
- uploads directory contents
- manifest json with export time and app version

- [ ] **Step 2: Exclude secrets**

Decide whether DeepSeek API key is excluded from backup by default.

Recommended default: exclude API key.

- [ ] **Step 3: UI**

Settings page button:

```text
导出本地备份
```

- [ ] **Step 4: Tests**

Verify zip exists and does not include API key.

## Phase 9: Verification And APK

- [ ] **Step 1: Full test suite**

```bash
PATH="/Users/liang/.openclaw/tools/node-v22.22.0/bin:$PATH" npm test
PATH="/Users/liang/.openclaw/tools/node-v22.22.0/bin:$PATH" npm run lint
```

- [ ] **Step 2: Browser verification**

Check 390x844 mobile viewport:

- Settings DeepSeek status
- Today explanation
- Records weekly review
- Action replacement
- Photo comparison

- [ ] **Step 3: Production build**

```bash
PATH="/Users/liang/.openclaw/tools/node-v22.22.0/bin:$PATH" npm run build
PATH="/Users/liang/.openclaw/tools/node-v22.22.0/bin:$PATH" npx cap copy android
```

- [ ] **Step 4: APK build**

```bash
cd android
JAVA_HOME="/tmp/codex-jdk/jdk-21.0.11+10/Contents/Home" \
PATH="/Users/liang/.openclaw/tools/node-v22.22.0/bin:$JAVA_HOME/bin:$PATH" \
./gradlew assembleDebug --no-daemon
```

- [ ] **Step 5: Copy APK to desktop**

```bash
PATH="/Users/liang/.openclaw/tools/node-v22.22.0/bin:$PATH" npm run apk:desktop
```

- [ ] **Step 6: Runtime safety check**

Confirm:

- no `5173` or `8787` dev service left running unless Liang asked for it
- no API key appears in `git diff`
- no posture photos copied into repo

## Implementation Order Recommendation

Do this order:

1. DeepSeek settings and secret safety.
2. Local daily explanation.
3. AI daily explanation.
4. Weekly review.
5. Action replacement.
6. Photo comparison notes.
7. Backup export.
8. APK.

Reason: secret handling and local fallback must be stable before AI features are visible.

