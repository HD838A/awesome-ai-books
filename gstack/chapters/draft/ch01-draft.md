# 第1章：gstack 是什么——AI 工程流水线的愿景

> "I don't think I've typed like a line of code probably since December, basically, which is an extremely large change."
> — Andrej Karpathy，No Priors podcast，2026年3月

2026年3月，Karpathy 在播客中说出这番话时，整个科技圈都在追问：**一个人怎么可能不写代码，却能持续交付？**

Garry Tan——Y Combinator 的掌舵人——也在思考这个问题。答案是 **gstack**：一个把 AI 编程工具变成"虚拟工程团队"的框架。

---

## 概述

本章我们将了解：
- gstack 试图解决什么根本问题
- 它如何用"交响乐团"模型重构 AI 编程
- 37个技能 + 8个工具的完整地图
- 30秒安装体验

读完本章，你会理解为什么 gstack 不只是一个工具集合，而是一种**工作方式的转变**。

---

## 1.1 问题的本质：传统 AI 编程的四大困境

让我们先承认一个事实：大多数 AI 编程工具，本质上是一个**更聪明的代码补全器**。

你给 Copilot 一段代码，它补全下一行。你给 Claude Code 一个提示，它生成一个文件。**但然后呢？**

传统 AI 编程面临四大困境：

### 无状态之痛

每次对话，AI 都是从零开始。变量、上下文、登录状态——全部丢失。测试环境要重新配，Cookie 要重新导，浏览器要重新开。

### 万能之惑

一个 AI 回答所有问题：写代码、审代码、做架构、测功能、发布上线。**但没有人是全能的，AI 也不例外。** 让同一个模型同时扮演 CTO 和 QA 工程师，结果往往是两边都不够深入。

### 质量之漏

AI 生成的代码通过了语法检查，但可能在生产环境崩溃。竞态条件、SQL 注入、边界情况——这些问题需要专业视角，但通用 AI 往往视而不见。

### 流程之断

代码写完就结束。没有审查、没有测试、没有发布流程、没有文档更新。一切靠人工串联，AI 只负责"写代码"这一环。

### 传统工具的尴尬

| 困境 | Copilot | Claude Code | gstack |
|------|---------|-------------|--------|
| 无状态 | ❌ 每次补全独立 | ❌ 每次会话独立 | ✅ 有状态（通过文件） |
| 专业分工 | ❌ 无 | ❌ 无 | ✅ 37个专业技能 |
| 质量门禁 | ❌ 无 | ❌ 基础检查 | ✅ 多阶段审查 |
| 完整流程 | ❌ 无 | ❌ 你自己串联 | ✅ 内置编排 |

---

## 1.2 交响乐团模型：gstack 的核心隐喻

gstack 的设计灵感来自**交响乐团**。

想象你走进一个排练厅，发现只有一个人在演奏所有乐器——钢琴、小提琴、鼓、长号。这听起来很荒谬，但大多数人的 AI 编程体验就是这样：**一个模型同时扮演 CEO、工程师、设计师、QA。**

交响乐团的智慧在于：**专业化分工 + 统一指挥**。

- 作曲家写乐谱（相当于产品需求）
- 指挥家协调全局（相当于产品经理）
- 每个乐手专注自己的乐器（相当于专业技能）

**gstack 就是你的 AI 交响乐团指挥家。** 你不需要自己演奏（写代码），你只需要在关键时刻给出节拍。

### 这个比喻的关键特征

| 乐团特征 | gstack 对应 |
|----------|------------|
| 指挥家 | 你，用户 |
| 乐手 | 37个专业技能 |
| 乐谱 | SKILL.md（技能定义） |
| 演奏 | AI Agent 执行技能 |
| 演出 | 从想法到发布的完整流程 |

**重要区分：** 指挥家不需要会拉小提琴，但必须懂音乐。**使用 gstack，你不需要懂 CDP 协议，但你需要知道 `/review` 能找 bug。**

---

## 1.3 完整技能地图

gstack 包含 **37个技能**，覆盖从"想法构思"到"发布回顾"的完整生命周期。

### 规划阶段：从模糊到清晰

| 技能 | 角色 | 核心功能 |
|------|------|----------|
| `/office-hours` | YC 导师 | 六问法重构产品想法，挑战你的前提假设 |
| `/plan-ceo-review` | CEO | 找到10星产品，挑战需求范围 |
| `/plan-eng-review` | 工程经理 | 锁定架构、数据流、测试计划 |
| `/plan-design-review` | 资深设计师 | 评分设计维度，解释"10分是什么样" |
| `/plan-devex-review` | DX 负责人 | 开发者体验审查，TTHW 基准测试 |

### 构建阶段：从计划到代码

| 技能 | 角色 | 核心功能 |
|------|------|----------|
| `/autoplan` | 审查编排 | 一键运行 CEO→设计→工程完整审查 |
| `/design-consultation` | 设计伙伴 | 从零构建设计系统 |
| `/design-shotgun` | 设计探索 | 生成多设计变体，打开对比板 |
| `/design-html` | 设计工程 | 生产级 HTML 生成（Pretext） |

### 审查阶段：质量门禁

| 技能 | 角色 | 核心功能 |
|------|------|----------|
| `/review` | 高级工程师 | 找 CI 测不出的 bug，自动修复明显问题 |
| `/investigate` | 调试专家 | 系统性根因分析，禁止无调查的修复 |
| `/devex-review` | DX 测试 | 真实体验审计，实际运行入门流程 |
| `/codex` | 第二意见 | OpenAI Codex 独立审查 |

### 测试阶段：真实验证

| 技能 | 角色 | 核心功能 |
|------|------|----------|
| `/qa` | QA 主管 | 真浏览器测试 + 修复 + 回归测试 |
| `/qa-only` | QA 报告 | 仅报告 bug，不做修改 |
| `/benchmark` | 性能工程师 | 页面加载、CWV、资源大小基准 |
| `/canary` | SRE | 部署后监控，错误率/性能回归 |

### 发布阶段：从代码到用户

| 技能 | 角色 | 核心功能 |
|------|------|----------|
| `/ship` | 发行工程师 | 同步 + 测试 + 推送 + PR |
| `/land-and-deploy` | 发行工程师 | 合并 + 等待 CI + 验证生产 |
| `/document-release` | 技术写作 | 自动更新所有项目文档 |

### 浏览器：给 AI 一双眼睛

| 技能 | 角色 | 核心功能 |
|------|------|----------|
| `/browse` | QA 工程师 | 无头浏览器，~100ms/命令 |
| `/open-gstack-browser` | 全栈浏览器 | 侧边栏 AI + 反爬 + Cookie 导入 |
| `/setup-browser-cookies` | 会话管理 | 从真实浏览器导入 Cookie |

### 工具类：安全与效率

| 技能 | 核心功能 |
|------|----------|
| `/retro` | 每周回顾，团队分析，发布趋势 |
| `/learn` | 跨会话记忆管理，项目知识积累 |
| `/careful` | 破坏性命令警告（rm -rf 等） |
| `/freeze` | 目录编辑锁定，硬约束 |
| `/guard` | careful + freeze 双重保护 |
| `/unfreeze` | 解除冻结 |
| `/gstack-upgrade` | 自动升级到最新版本 |

---

## 1.4 典型工作流：从想法到发布

让我们看一个真实场景。用户说：

> "I want to build a daily briefing app for my calendar."

### 第一拍：/office-hours

AI 不会直接开始写代码。它会问：

- 你有多少个日历？
- 信息多久更新一次？
- "结果不够好"具体是指什么？

用户回答后，AI 说：

> "你说的是'日历应用'，但你实际描述的是一个**个人首席助理 AI**。让我重新理解你的需求..."

**关键洞察：** AI 倾听的是**痛点**，不是**功能请求**。用户说"日历应用"，AI 说"你在构建首席助理"。

### 第二拍：规划审查

```
/plan-ceo-review   →  挑战范围，生成3种实现方案
/plan-eng-review   →  锁定架构、测试矩阵、安全考虑
```

规划阶段产出：
- 5个用户没意识到的能力需求
- 4个被挑战的前提假设
- 3种实现方案及工作量估算

### 第三拍：实现

用户批准计划后，Claude Code 自动写代码。**注意：用户不参与这个阶段。**

### 第四拍：/review

```
/review
[AUTO-FIXED] 2 issues
[ASK] Race condition detected — you approve fix?
```

审查阶段自动修复明显问题，标记需要人工判断的问题。

### 第五拍：/qa

```
/qa https://staging.myapp.com
[I SEE THE ISSUE] Form validation missing on mobile
[FIXED] Added mobile validation with atomic commit
[REGRESSION TEST] Added test case for mobile validation
```

QA 阶段打开真实浏览器，测试真实用户流程。

### 第六拍：/ship

```
/ship
Tests: 42 → 51 (+9 new)
Coverage: 67% → 78%
PR: github.com/you/app/pull/42
```

发布阶段：同步主分支、运行测试、推送代码、创建 PR。

### 完整流程

```mermaid
graph LR
    A[想法] --> B[/office-hours]
    B --> C[/plan-ceo-review]
    C --> D[/plan-eng-review]
    D --> E[写代码]
    E --> F[/review]
    F --> G[/qa]
    G --> H[/ship]
    H --> I[PR 已创建]
```

---

## 1.5 安装与快速体验

### 30秒安装

gstack 的安装简单到令人惊讶：

```bash
# 打开 Claude Code，粘贴这行命令
git clone --single-branch --depth 1 \
  https://github.com/garrytan/gstack.git \
  ~/.claude/skills/gstack && \
  cd ~/.claude/skills/gstack && ./setup
```

**Claude 会自动完成剩余步骤。**

### 多 Agent 支持

gstack 不只支持 Claude Code。目前支持 8 种 AI 编程工具：

| Agent | 安装路径 |
|-------|----------|
| Claude Code | `~/.claude/skills/` |
| OpenAI Codex CLI | `~/.codex/skills/` |
| Cursor | `~/.cursor/skills/` |
| OpenCode | `~/.config/opencode/skills/` |
| Factory Droid | `~/.factory/skills/` |
| Slate | `~/.slate/skills/` |
| Kiro | `~/.kiro/skills/` |
| OpenClaw | `~/.openclaw/skills/` |

每个 Agent 都有专门的适配层（见第7-8章）。

### 安装后验证

安装完成后，你会在 Claude Code 中看到 `/` 命令提示。试着运行：

```
/office-hours
```

按照提示回答问题，体验 gstack 的交互方式。

---

## 1.6 为什么是"流水线"而不是"工具集合"？

区分两个概念很重要：**工具集合** vs **流水线编排**。

### 工具集合

```
工具 A → 工具 B → 工具 C
```

你负责串联，工具之间没有数据流。

### gstack 流水线

```
/office-hours 的输出 → /plan-ceo-review 的输入
/plan-eng-review 的测试计划 → /qa 的测试用例
/review 的修复建议 → /ship 的提交信息
```

**技能之间有数据流。** 上一阶段的产出自动成为下一阶段的输入。

### 关键设计原则

1. **文件即状态**：所有状态存储在文件系统，Agent 无状态
2. **Markdown 即配置**：SKILL.md 是技能定义，`.tmpl` 是模板
3. **零侵入**：安装在 `~/.claude/`，不污染 PATH
4. **自动生成**：文档从模板生成，永不过时

---

## 1.7 目标读者：谁应该使用 gstack？

### 创业者 / 技术 CEO

**痛点：** 想保持技术视野，但没时间深入每一行代码。

**gstack 如何帮助：**
- `/plan-ceo-review` 让你快速理解技术决策
- `/review` 帮你审查代码质量
- `/ship` 自动化发布流程

**你不需要：** 懂 CDP 协议、OWASP 漏洞、Playwright API。

### Claude Code 新手

**痛点：** 面对空白提示，不知道怎么开始。

**gstack 如何帮助：**
- `/office-hours` 引导你思考产品问题
- 结构化流程替代空白提示
- 每个技能都有明确目标

**你不需要：** 记住所有最佳实践，技能会引导你。

### Tech Lead / Staff Engineer

**痛点：** 团队代码质量参差不齐，审查耗时。

**gstack 如何帮助：**
- `/review` 自动化代码审查
- `/qa` 真浏览器测试
- `/ship` 标准化发布流程

**你不需要：** 每次都手动审查所有 PR。

---

## 本章小结

1. **gstack 解决的根本问题**：让 AI 从"万能工具"变成"专业团队"

2. **核心隐喻**：交响乐团指挥家——你指挥，AI 执行专业任务

3. **37个技能覆盖完整生命周期**：规划→构建→审查→测试→发布→回顾

4. **技能之间有数据流**：上一阶段的产出自动流入下一阶段

5. **30秒安装，多 Agent 支持**：不只 Claude Code，8种工具通用

---

## 预告

第2章我们将深入 **gstack 的守护进程架构**：为什么需要一个持久化的浏览器进程？状态文件如何工作？版本自动重启机制是如何实现的？

<!-- DRAFT_COMPLETE -->
