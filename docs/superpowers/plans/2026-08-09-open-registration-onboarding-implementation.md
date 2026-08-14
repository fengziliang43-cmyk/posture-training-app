# 姿序开放注册、首次建档与动作视频实施计划

**依据：** `docs/superpowers/specs/2026-08-09-open-registration-onboarding-design.md`

## Task 1：迁移与回滚护栏

- 建立 schema version、用户档案、同意记录与持久 session 表。
- 重建核心数据表，增加 `user_id` 和复合唯一约束。
- 把旧数据回填给最早创建的现有用户。
- 在临时数据库和真实数据库副本上验证幂等、外键与 `integrity_check`。

## Task 2：用户级数据访问

- 把 repository 改为 `forUser(userId)` 作用域。
- 所有读取、更新、删除、替换和导出必须携带用户范围。
- 增加跨账号对象 ID 越权测试。

## Task 3：开放注册与持久认证

- 新增开放注册、密码规则、用户名规范化和限流。
- 增加生产注册闸门与公开 capability 接口；生产默认关闭，前端隐藏入口、后端拒绝请求。
- 网页只使用 Secure/HttpOnly Cookie；原生 App 才保存 bearer token。
- 补注销、当前用户与 onboarding 状态返回。

## Task 4：首次建档

- 新增 profile API 与分步 onboarding UI。
- 保存档案版本、健康信息单独同意和完成时间。
- 未完成建档时，训练计划 API 返回明确的 onboarding-required 状态。

## Task 5：档案驱动训练与视频链接

- 把器械、经验、目标、功能基线和限制传入计划生成器。
- 保持红旗、疼痛和历史反馈优先级不变。
- 为全部动作补视频元数据、链接校验测试和动作卡按钮。

## Task 6：隐私与部署准备

- 增加隐私/服务边界页面、个人导出和注销能力。
- 增加生产环境示例、Caddy 与 systemd/容器化最小部署说明。
- 生产配置缺少强 Cookie secret 或 HTTPS Cookie 时 fail closed。

## Task 7：验证

- 运行定向测试、全量 `npm test`、`npm run lint`、`npm run build`。
- 对迁移副本运行 `PRAGMA foreign_key_check` 与 `PRAGMA integrity_check`。
- 检查 git diff、未追踪文件和隐私数据边界；不提交、不推送、不公开部署。
