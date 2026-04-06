# Superpowers 源码映射

## 项目信息

| 属性 | 值 |
|------|-----|
| 项目名 | Superpowers |
| 版本/Commit | v5.0.7 |
| 仓库地址 | https://github.com/obra/superpowers |
| 主要语言 | JavaScript/TypeScript, Shell, Markdown |
| 总文件数 | 约 100 个 |
| 本书覆盖文件数 | 约 60 个 |

## 项目目录概览

```
superpowers/
├── .opencode/                    # OpenCode 插件系统
│   ├── plugins/superpowers.js    # 核心插件文件
│   └── INSTALL.md                # OpenCode 安装指南
├── .cursor-plugin/               # Cursor 插件配置
│   └── plugin.json
├── .codex/                       # Codex 配置
│   └── INSTALL.md
├── .github/                      # GitHub 配置
│   ├── ISSUE_TEMPLATE/           # Issue 模板
│   ├── PULL_REQUEST_TEMPLATE.md # PR 模板
│   └── FUNDING.yml
├── hooks/                        # Hooks 系统
│   ├── hooks.json                # Claude Code hooks 配置
│   ├── hooks-cursor.json        # Cursor hooks 配置
│   ├── session-start            # 会话启动钩子脚本
│   └── run-hook.cmd              # Windows hook 运行脚本
├── skills/                       # Skills 系统（核心）
│   ├── brainstorming/            # 头脑风暴技能
│   ├── subagent-driven-development/  # 子代理驱动开发
│   ├── writing-plans/           # 编写计划技能
│   ├── executing-plans/         # 执行计划技能
│   ├── systematic-debugging/    # 系统化调试
│   ├── test-driven-development/ # 测试驱动开发
│   ├── receiving-code-review/   # 接收代码审查
│   ├── requesting-code-review/   # 请求代码审查
│   ├── finishing-a-development-branch/  # 完成开发分支
│   ├── dispatching-parallel-agents/    # 并行调度代理
│   ├── verification-before-completion/  # 完成前验证
│   ├── using-git-worktrees/     # Git Worktrees 使用
│   ├── writing-skills/           # 编写 Skills
│   └── using-superpowers/       # 使用 Superpowers
├── tests/                        # 测试套件
│   ├── brainstorm-server/        # 头脑风暴服务器测试
│   ├── claude-code/              # Claude Code 集成测试
│   ├── explicit-skill-requests/  # 显式技能请求测试
│   ├── opencode/                 # OpenCode 集成测试
│   ├── skill-triggering/         # 技能触发测试
│   └── subagent-driven-dev/      # 子代理驱动开发测试
├── docs/                         # 文档
│   ├── README.codex.md           # Codex 文档
│   ├── README.opencode.md        # OpenCode 文档
│   ├── testing.md                # 测试文档
│   ├── superpowers/              # 设计文档
│   │   ├── specs/               # 规格文档
│   │   └── plans/               # 实施计划
│   └── windows/                 # Windows 相关
├── commands/                     # 命令文件
├── agents/                       # Agent 定义
├── scripts/                      # 脚本
└── 配置文件                      # README.md, CLAUDE.md, package.json 等
```

## 源码映射表

### 第一部分: 基础与架构

#### 第1章: Superpowers 概述与快速上手

| 源码路径 | 核心文件 | 重要度 | 备注 |
|----------|----------|--------|------|
| / | README.md | 高 | 项目介绍、安装指南、快速开始 |
| / | CLAUDE.md | 高 | AI 代理行为准则、PR 要求 |
| / | package.json | 中 | 版本信息、依赖声明 |
| .opencode/ | INSTALL.md | 高 | OpenCode 安装详细指南 |
| .codex/ | INSTALL.md | 中 | Codex 安装指南 |
| / | RELEASE-NOTES.md | 低 | 版本发布说明 |
| / | CHANGELOG.md | 低 | 变更日志 |

#### 第2章: 系统架构设计

| 源码路径 | 核心文件 | 重要度 | 备注 |
|----------|----------|--------|------|
| .opencode/plugins/ | superpowers.js | 高 | 插件入口、bootstrap 生成、配置注入 |
| hooks/ | session-start | 高 | 会话启动脚本、上下文注入 |
| hooks/ | hooks.json | 高 | Claude Code hook 配置 |
| hooks/ | hooks-cursor.json | 高 | Cursor hook 配置 |
| hooks/ | run-hook.cmd | 中 | Windows hook 运行脚本 |
| skills/ | using-superpowers/SKILL.md | 高 | 核心引导技能 |
| agents/ | code-reviewer.md | 中 | 代码审查 agent 定义 |
| / | CLAUDE.md | 中 | 项目规范和贡献指南 |

### 第二部分: 核心技能系统

#### 第3章: Skills 系统实现

| 源码路径 | 核心文件 | 重要度 | 备注 |
|----------|----------|--------|------|
| skills/ | writing-skills/SKILL.md | 高 | Skill 编写指南核心 |
| skills/ | writing-skills/anthropic-best-practices.md | 高 | Anthropic 最佳实践 |
| skills/ | writing-skills/persuasion-principles.md | 中 | 说服技巧 |
| skills/ | writing-skills/graphviz-conventions.dot | 低 | 图形约定 |
| skills/ | writing-skills/render-graphs.js | 低 | 图形渲染脚本 |
| skills/ | writing-skills/testing-skills-with-subagents.md | 高 | 测试方法论 |
| skills/ | writing-skills/examples/CLAUDE_MD_TESTING.md | 中 | 测试示例 |

#### 第4章: Brainstorming 技能

| 源码路径 | 核心文件 | 重要度 | 备注 |
|----------|----------|--------|------|
| skills/brainstorming/ | SKILL.md | 高 | 核心技能定义，HARD-GATE 原则 |
| skills/brainstorming/ | visual-companion.md | 高 | 视觉化设计支持 |
| skills/brainstorming/ | spec-document-reviewer-prompt.md | 中 | 规范文档审查提示 |
| skills/brainstorming/scripts/ | server.cjs | 中 | 头脑风暴服务器 |
| skills/brainstorming/scripts/ | helper.js | 中 | 服务器辅助函数 |
| skills/brainstorming/scripts/ | frame-template.html | 中 | 界面模板 |
| skills/brainstorming/scripts/ | start-server.sh | 中 | 服务器启动脚本 |
| skills/brainstorming/scripts/ | stop-server.sh | 中 | 服务器停止脚本 |

#### 第5章: Subagent-Driven Development

| 源码路径 | 核心文件 | 重要度 | 备注 |
|----------|----------|--------|------|
| skills/subagent-driven-development/ | SKILL.md | 高 | 核心子代理开发技能 |
| skills/subagent-driven-development/ | implementer-prompt.md | 高 | 实现者子代理提示 |
| skills/subagent-driven-development/ | spec-reviewer-prompt.md | 高 | 规范审查者提示 |
| skills/subagent-driven-development/ | code-quality-reviewer-prompt.md | 高 | 代码质量审查者提示 |
| agents/ | code-reviewer.md | 高 | 代码审查 agent 定义 |
| skills/ | executing-plans/SKILL.md | 高 | 计划执行技能（关联） |
| skills/ | writing-plans/SKILL.md | 中 | 计划编写技能（关联） |

#### 第6章: 其他核心技能

| 源码路径 | 核心文件 | 重要度 | 备注 |
|----------|----------|--------|------|
| skills/writing-plans/ | SKILL.md | 高 | 实现计划编写技能 |
| skills/writing-plans/ | plan-document-reviewer-prompt.md | 中 | 计划审查提示 |
| skills/requesting-code-review/ | SKILL.md | 高 | 请求代码审查技能 |
| skills/requesting-code-review/ | code-reviewer.md | 中 | 审查者提示 |
| skills/receiving-code-review/ | SKILL.md | 高 | 接收代码审查技能 |
| skills/finishing-a-development-branch/ | SKILL.md | 高 | 完成分支技能 |
| skills/dispatching-parallel-agents/ | SKILL.md | 中 | 并行调度代理技能 |
| skills/executing-plans/ | SKILL.md | 高 | 执行计划技能 |

### 第三部分: 工程实践

#### 第7章: Systematic Debugging 技能

| 源码路径 | 核心文件 | 重要度 | 备注 |
|----------|----------|--------|------|
| skills/systematic-debugging/ | SKILL.md | 高 | 系统化调试核心 |
| skills/systematic-debugging/ | defense-in-depth.md | 高 | 防御式编程原则 |
| skills/systematic-debugging/ | root-cause-tracing.md | 高 | 根因追踪方法 |
| skills/systematic-debugging/ | condition-based-waiting.md | 高 | 条件等待模式 |
| skills/systematic-debugging/ | condition-based-waiting-example.ts | 中 | 条件等待示例 |
| skills/systematic-debugging/ | find-polluter.sh | 高 | 污染检测脚本 |
| skills/systematic-debugging/ | CREATION-LOG.md | 低 | 创建日志 |
| skills/systematic-debugging/ | test-pressure-1.md | 中 | 压力测试方法 1 |
| skills/systematic-debugging/ | test-pressure-2.md | 中 | 压力测试方法 2 |
| skills/systematic-debugging/ | test-pressure-3.md | 中 | 压力测试方法 3 |
| skills/systematic-debugging/ | test-academic.md | 低 | 学术测试参考 |

#### 第8章: Test-Driven Development 技能

| 源码路径 | 核心文件 | 重要度 | 备注 |
|----------|----------|--------|------|
| skills/test-driven-development/ | SKILL.md | 高 | TDD 核心技能 |
| skills/test-driven-development/ | testing-anti-patterns.md | 高 | 测试反模式 |
| skills/verification-before-completion/ | SKILL.md | 高 | 完成前验证 |

### 第四部分: 平台与生态

#### 第9章: 多平台适配

| 源码路径 | 核心文件 | 重要度 | 备注 |
|----------|----------|--------|------|
| .opencode/plugins/ | superpowers.js | 高 | OpenCode 插件实现 |
| .cursor-plugin/ | plugin.json | 高 | Cursor 插件配置 |
| .codex/ | INSTALL.md | 高 | Codex 安装机制 |
| hooks/ | session-start | 高 | 跨平台 hook 适配 |
| skills/using-superpowers/ | SKILL.md | 中 | 跨平台引导 |
| skills/using-superpowers/references/ | codex-tools.md | 中 | Codex 工具映射 |
| skills/using-superpowers/references/ | copilot-tools.md | 中 | Copilot 工具映射 |
| skills/using-superpowers/references/ | gemini-tools.md | 中 | Gemini 工具映射 |
| docs/ | README.codex.md | 中 | Codex 文档 |
| docs/ | README.opencode.md | 中 | OpenCode 文档 |
| docs/ | windows/polyglot-hooks.md | 低 | Windows hook 说明 |

#### 第10章: 高级主题与生态

| 源码路径 | 核心文件 | 重要度 | 备注 |
|----------|----------|--------|------|
| skills/using-git-worktrees/ | SKILL.md | 高 | Git Worktrees 使用 |
| skills/writing-skills/ | SKILL.md | 高 | Skill 编写（贡献者必读） |
| agents/ | code-reviewer.md | 高 | 审查 agent 定义 |
| / | CLAUDE.md | 高 | 贡献指南核心 |
| / | CODE_OF_CONDUCT.md | 中 | 行为准则 |
| docs/superpowers/ | specs/*.md | 中 | 设计文档 |
| docs/superpowers/ | plans/*.md | 中 | 实施计划 |

### 附录

#### 附录A: Superpowers 贡献指南精读

| 源码路径 | 核心文件 | 重要度 | 备注 |
|----------|----------|--------|------|
| / | CLAUDE.md | 高 | 贡献者指南完整内容 |
| .github/ | PULL_REQUEST_TEMPLATE.md | 高 | PR 模板 |
| agents/ | code-reviewer.md | 高 | PR 审查要点 |
| / | CODE_OF_CONDUCT.md | 中 | 行为准则 |
| skills/writing-skills/ | SKILL.md | 中 | Skill 变更评估方法 |

### 测试文件映射（参考）

| 源码路径 | 重要度 | 备注 |
|----------|--------|------|
| tests/brainstorming/server.test.js | 中 | 头脑风暴服务器测试 |
| tests/brainstorming/ws-protocol.test.js | 中 | WebSocket 协议测试 |
| tests/claude-code/ | 中 | Claude Code 集成测试 |
| tests/opencode/ | 中 | OpenCode 集成测试 |
| tests/skill-triggering/ | 中 | 技能触发测试 |
| tests/subagent-driven-dev/ | 中 | 子代理开发测试 |

---

## 重点文件说明

### 必读核心文件（高重要度）

1. **superpowers.js** - 插件入口文件，包含 bootstrap 生成、配置注入、平台适配
2. **session-start** - 会话启动脚本，跨平台上下文注入
3. **brainstorming/SKILL.md** - 核心设计技能，展示 Skill 的标准结构
4. **subagent-driven-development/SKILL.md** - 子代理开发模式，复杂工作流示例
5. **writing-skills/SKILL.md** - Skill 编写指南元技能
6. **CLAUDE.md** - 贡献指南，了解项目规范

### 理解架构的关键文件

1. **systematic-debugging/SKILL.md** - 调试方法论
2. **test-driven-development/SKILL.md** - TDD 实践
3. **hooks.json / hooks-cursor.json** - Hook 配置差异
