# 只读钥匙与导出接口实现计划

依据：`docs/superpowers/specs/2026-11-17-read-only-export-token.md`；中控台那边的施工单：中控台工程 `docs/姿序接入施工单-2026-11-17.md`。

## 实施清单（A1–A6）

1. **A1. 数据库（`src/server/migrations.ts`）**：`CURRENT_SCHEMA_VERSION` 从 2 改成 3，新增 `read_tokens` 表与 `idx_read_tokens_user` 索引，并补充从版本 2 迁移及完整性校验测试。
2. **A2. 存取（`src/server/repositories.ts`）**：在 `forUser(userId)` 中新增 `listReadTokens()`、`createReadToken(name, tokenHash)`、`revokeReadToken(id)`，顶层新增 `findReadToken(tokenHash)`、`touchReadToken(id)`，并确认备份接口 `collectUserData` 不包含 `read_tokens`。
3. **A3. 钥匙的管理接口（`src/server/routes/read-tokens.ts`、`src/server/app.ts`）**：基于登录会话实现 `GET /api/read-tokens`、`POST /api/read-tokens`（上限 5 把，原文只返回一次）、`DELETE /api/read-tokens/:id` 并在 `app.ts` 注册。
4. **A4. 导出接口（`src/server/routes/read-tokens.ts`）**：实现仅接受 `Authorization: Bearer <钥匙>` 的 `GET /api/export/summary`，按钥匙限流每小时 60 次，只返回本周/本月训练日、本周建议、近 14 天不适/精力/危险信号布尔值及最近一次档位调整，并在该路由屏蔽 `Authorization` 请求头日志。
5. **A5. 「我的 → 账号与隐私」前端（`src/web/components/ReadTokensCard.tsx`、`src/web/components/MeView.tsx`、`src/web/api.ts`）**：在隐私页新增只读钥匙生成、展示（一次性原文与复制）、列表与作废卡片，不改变设置菜单入口。
6. **A6. 测试（`tests/server/read-tokens.test.ts`）**：覆盖钥匙创建/列表/作废/上限/注销级联删除、导出白名单与隐私过滤、限流、cookie 隔离、跨账号隔离与备份排除测试。
