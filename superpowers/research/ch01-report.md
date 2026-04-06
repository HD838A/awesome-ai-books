# 第1章研究报告：Superpowers 概述与快速上手

## 研究概览

| 属性 | 值 |
|------|-----|
| 章节 | ch01: Superpowers 概述与快速上手 |
| 源码文件 | README.md, CLAUDE.md, package.json, docs/README.opencode.md, docs/README.codex.md |
| 研究深度 | 完整阅读所有相关文件 |
| 关键发现 | 11 个核心发现 |

## 源码文件分析

### 1. README.md — 项目主文档

**文件路径**: `/Users/yaya/.openclaw/workspace/superpowers/README.md`

**核心内容**:
- 项目定位：Superpowers 是一个"complete software development workflow"（完整的软件开发工作流）
- 核心理念：从"写代码"进化到"做工程"——AI 不是直接写代码，而是先理解需求、做设计、再实现
- 工作流程：brainstorming → writing-plans → subagent-driven-development/executing-plans → TDD

**关键工作流程**（按顺序）:
1. **brainstorming** - 在写代码之前激活，通过提问细化需求，呈现分段设计
2. **using-git-worktrees** - 设计批准后，创建隔离工作空间
3. **writing-plans** - 分解为小任务（每个 2-5 分钟）
4. **subagent-driven-development / executing-plans** - 子代理执行或批量执行
5. **test-driven-development** - 强制红-绿-重构
6. **requesting-code-review** - 任务间审查
7. **finishing-a-development-branch** - 完成时清理

**Skills 分类**:
- Testing: test-driven-development
- Debugging: systematic-debugging, verification-before-completion
- Collaboration: brainstorming, writing-plans, executing-plans, dispatching-parallel-agents, requesting-code-review, receiving-code-review, using-git-worktrees, finishing-a-development-branch, subagent-driven-development
- Meta: writing-skills, using-superpowers

**哲学原则**:
- Test-Driven Development
- Systematic over ad-hoc
- Complexity reduction
- Evidence over claims

**支持平台**:
- Claude Code (官方市场)
- Cursor (官方市场)
- Codex
- OpenCode
- GitHub Copilot CLI
- Gemini CLI

### 2. CLAUDE.md — 贡献者指南

**文件路径**: `/Users/yaya/.openclaw/workspace/superpowers/CLAUDE.md`

**核心理念**:
- 94% PR 拒绝率！维护者会关闭"slop PRs"
- AI agent 的职责是保护人类伙伴不被尴尬
- 必须遵循的 PR 检查清单：
  1. 完整填写 PR 模板
  2. 搜索现有 PR（开源和已关闭）
  3. 验证这是真实问题
  4. 确认变更属于核心
  5. 展示完整 diff 并获得人类批准

**不接受的 PR 类型**:
- 第三方依赖（除非支持新平台）
- "合规"修改 Skills（哲学不同）
- 项目特定或个人配置
- 批量/撒网式 PR
- 推测性修复
- 领域特定 Skills
- Fork 特定变更
- 虚构内容
- 捆绑不相关变更

**Skill 变更要求**:
- 必须使用 writing-skills 开发
- 必须运行对抗性压力测试
- 必须展示评估结果

### 3. package.json — 包配置

**文件路径**: `/Users/yaya/.openclaw/workspace/superpowers/package.json`

```json
{
  "name": "superpowers",
  "version": "5.0.7",
  "type": "module",
  "main": ".opencode/plugins/superpowers.js"
}
```

**关键信息**:
- 当前版本：5.0.7
- ESM 模块
- 主入口：.opencode/plugins/superpowers.js

### 4. OpenCode 安装文档

**文件路径**: `/Users/yaya/.openclaw/workspace/superpowers/docs/README.opencode.md`

**安装方式**:
```json
{
  "plugin": ["superpowers@git+https://github.com/obra/superpowers.git"]
}
```

**插件功能**:
1. 注入 bootstrap 上下文（通过 `experimental.chat.system.transform` hook）
2. 注册 skills 目录（通过 `config` hook）

**验证安装**: 问 "Tell me about your superpowers"

### 5. Codex 安装文档

**文件路径**: `/Users/yaya/.openclaw/workspace/superpowers/docs/README.codex.md`

**安装方式**:
1. git clone → `~/.codex/superpowers`
2. 创建 symlink → `~/.agents/skills/superpowers`
3. 重启 Codex

**关键**: Codex 原生支持 skill 发现，自动扫描 `~/.agents/skills/`

## 关键发现

### 发现 1: Superpowers 的核心价值主张

Superpowers 不是让 AI 更快地写代码，而是让 AI 学会"先想清楚再动手"。这与大多数 AI 编程助手的理念形成鲜明对比——那些工具追求的是"秒级生成代码"，而 Superpowers 追求的是"一次做对"。

### 发现 2: "Human Partner" 概念

Superpowers 文档中使用"human partner"而非"user"。这是一个有意为之的术语选择，强调人类和 AI 之间的关系是"伙伴"而非"主人-工具"。这也体现在 PR 指南中——AI agent 的职责是保护人类伙伴不被尴尬。

### 发现 3: 零依赖设计

Superpowers 坚持零第三方依赖。这是设计决策，而非技术限制。这个决定意味着：
- 不会有依赖地狱
- 安装简单
- 但需要手写更多基础设施代码

### 发现 4: 94% PR 拒绝率的背景

94% 的 PR 被拒绝不是傲慢，而是质量控制。维护者见过太多 AI 生成的"slop"——那些看起来有用但实际上有害的 PR。这个高拒绝率说明：
- 提交前必须充分准备
- 人类审查不可跳过
- 问题必须真实存在

### 发现 5: Skills 自动触发

Skills 的设计让它们能够自动触发，不需要用户手动调用。这意味着：
- 工作流程是"默认正确"的
- 培训成本低
- 但也意味着行为改变是全局性的

### 发现 6: 多平台支持

支持 6 个主流平台，每个平台有不同的安装机制：
- 有官方市场的（Claude Code, Cursor）：最简单
- 需要手动配置的（Codex, OpenCode）：需要 JSON 配置
- CLI 工具（Copilot, Gemini）：最简单

### 发现 7: 技能分类清晰

Skills 分为四大类：
- Testing（测试）
- Debugging（调试）
- Collaboration（协作）
- Meta（元技能）

这种分类帮助用户理解每个技能的作用。

### 发现 8: 红-绿-重构的强制执行

TDD 在 Superpowers 中是"强制"而非"建议"。如果代码在测试之前写，TDD 技能会要求删除那些代码。

### 发现 9: Subagent-Driven Development 是核心创新

这是 Superpowers 与其他工具最不同的地方。通过子代理分工和两阶段审查，实现大规模迭代而不失质量。

### 发现 10: 文档即代码

CLAUDE.md 文件放在项目根目录，这是给 AI agent 看的"README"。这种"文档即代码"的理念贯穿整个项目。

### 发现 11: 版本策略

当前版本 5.0.7，说明这是一个成熟项目。版本号使用语义化版本，但更新是"自动"的（通过 git pull）。

## 写作要点

1. **开篇故事**: 用一个"AI 帮你写代码但写出来的东西跑不通"的场景引入
2. **对比手法**: 展示 Superpowers 的工作流程 vs 其他工具的"直接开写"
3. **实操优先**: 安装指南要详细，覆盖所有 6 个平台
4. **不要低估门槛**: 虽然设计哲学简单，但需要理解才能正确使用

## 待深入章节

- 工作流程中涉及的具体技能将在后续章节详细讲解
- CLAUDE.md 的详细内容在附录 A 中讨论

## 参考资料

- [Superpowers for Claude Code](https://blog.fsck.com/2025/10/09/superpowers/)
- GitHub Issues: https://github.com/obra/superpowers/issues
- Discord 社区: https://discord.gg/Jd8Vphy9jq

<!-- RESEARCH_COMPLETE -->
