# 参与姿序共建

姿序欢迎代码、测试、产品、设计、文档和内容贡献。不会写代码也可以从动作视频核对、移动端体验测试、无障碍检查或文案改进开始。

## 开始之前

1. 阅读 [README](README.md)、[项目规则](AGENTS.md)、[安全报告说明](SECURITY.md)和[第三方材料边界](THIRD_PARTY_NOTICES.md)。
2. 在现有 Issue 中选择带有 `good first issue` 或 `help wanted` 标签的任务；较大改动先在 Issue 中确认范围。
3. 不要在 Issue、截图、测试数据或提交中放入真实健康资料、体态照片、姓名、邮箱、服务器日志、密码、API Key 或其他凭证。
4. 训练算法、疼痛提示和侧弯教育相关改动必须保留非诊断边界与红旗症状停训规则。

## 本地验证

项目使用 Node.js、npm、Vite、React、Fastify 和 SQLite。克隆后运行：

```bash
npm ci
npm test
npm run lint
npm run build
git diff --check
```

本地开发默认不需要真实账号或 API Key：

```bash
npm run dev:server
npm run dev:web
```

默认地址为 `http://localhost:8787` 和 `http://localhost:5173`。请只使用合成测试数据。

## Pull Request 要求

- 一次 PR 解决一个清晰问题，并关联对应 Issue。
- 说明用户可感知的变化、验证方法和仍未覆盖的风险。
- 功能或缺陷修复应补充与风险相称的测试。
- 不提交 `node_modules/`、构建产物、APK/IPA、数据库、上传目录、`.env`、签名材料或凭证。
- 涉及界面的 PR 可提供脱敏截图；涉及隐私或安全漏洞时不要在公开 PR 中披露利用细节。

维护者会根据安全性、产品边界、可维护性和验证结果决定是否合并。贡献提交后，贡献者同意其贡献按本项目的 [MIT License](LICENSE) 发布。

## 社区约定

本项目遵守升级打怪开源社区的[行为准则](https://github.com/shengjidaguai-china/.github/blob/main/CODE_OF_CONDUCT.md)和[参与规则](https://github.com/shengjidaguai-china/.github/blob/main/CONTRIBUTING.md)。

---

## Contributing in English

Contributions in code, tests, product design, documentation, accessibility, and content are welcome. Start from an Issue labelled `good first issue` or `help wanted`, and discuss larger changes before implementation.

Never include real health records, posture photos, personal identifiers, credentials, API keys, production logs, or production data in public collaboration. Changes to training decisions or medical-boundary copy must preserve red-flag stops and non-diagnostic language.

Run `npm ci`, `npm test`, `npm run lint`, `npm run build`, and `git diff --check` before requesting review. Contributions are submitted under the repository's MIT License.
