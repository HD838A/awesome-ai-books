# ch06 研究报告：autoplan 与 review-army 深度解析

> **批次**: Phase 3 第 2 批（ch04-ch06）
> **研究员**: Scriptorium Phase 3.11
> **研究日期**: 2026-04-06
> **状态**: ✅ 完成

---

## 1. 研究目标

本章聚焦两个规模化 SKILL 实践：

1. **autoplan**：全自动化审查流水线，一次调用跑完 CEO/Design/Eng/DX 四层审查
2. **review-army 深度**：专家分派、自适应门控、发现合并的完整流程

研究问题：

- autoplan 如何用 6 条决策原则替代用户判断？
- Review Army 的自适应门控如何随时间优化？
- 置信度校准如何在发现中平衡精确性和覆盖率？
- 红队分派的触发条件是什么？

---

## 2. 核心源文件

| 文件路径 | 行数 | 职责 |
|----------|------|------|
| `autoplan/SKILL.md.tmpl` | ~800+ | 全自动化审查流水线模板 |
| `scripts/resolvers/review-army.ts` | ~400+ | Review Army 四步流程 |
| `scripts/resolvers/confidence.ts` | ~37 | 置信度校准 rubric |

---

## 3. autoplan 全自动化审查

### 3.1 核心定位

autoplan 是 gstack 的**一键全审查**技能。它读取完整的 CEO、Design、Eng、DX 四层审查技能文件，并按顺序执行——与手动运行每个技能同等深度，但所有中间 AskUserQuestion 用 6 条决策原则自动回答。

**触发场景**：
- 用户说 "auto review"、"autoplan"、"run all reviews"
- 用户有 plan 文件但不想回答 15-30 个中间问题

### 3.2 六条决策原则

autoplan 的核心是 **6 条决策原则**，用于自动回答所有中间问题：

```markdown
1. **Choose completeness** — Ship the whole thing. Pick the approach that covers more edge cases.
2. **Boil lakes** — Fix everything in the blast radius. Auto-approve expansions that are in blast radius AND < 1 day CC effort.
3. **Pragmatic** — If two options fix the same thing, pick the cleaner one. 5 seconds choosing, not 5 minutes.
4. **DRY** — Duplicates existing functionality? Reject. Reuse what exists.
5. **Explicit over clever** — 10-line obvious fix > 200-line abstraction.
6. **Bias toward action** — Merge > review cycles > stale deliberation.
```

### 3.3 决策分类

每条自动决策被分为三类：

| 分类 | 特征 | 处理方式 |
|------|------|----------|
| **Mechanical** | 唯一正确答案 | 静默自动决定 |
| **Taste** | 合理人会有分歧 | 自动决定但最终门控上浮 |
| **User Challenge** | 双模型同意用户方向应改 | 从不自动决定，上浮用户确认 |

**User Challenge 的特殊处理**：
当 Claude 和 Codex 都认为用户陈述的方向应该改变（合并/拆分/增加/删除功能），这是 User Challenge——从不自动决定。

User Challenge 需要更丰富的上下文：
- 用户说了什么（原始方向）
- 双模型推荐什么（改变内容）
- 为什么（模型的推理）
- 我们可能缺少什么上下文（明确承认盲点）
- 如果我们错了，代价是什么

### 3.4 顺序执行（强制）

autoplan 严格按顺序执行四阶段：

```
Phase 0: Intake + Restore Point
    ↓
Phase 1: CEO Review（策略与范围）
    ↓
Phase 2: Design Review（条件性，UI scope 时）
    ↓
Phase 3: Eng Review（架构与测试）
    ↓
Phase 4: DX Review（条件性，DX scope 时）
    ↓
Final Gate: Taste Decisions 汇总确认
```

每阶段必须完全完成后才能开始下一阶段。从不并行执行——每一层建立在上一层之上。

### 3.5 Phase 0 摄入检查

Phase 0 三个关键检测：

**UI Scope 检测**：
```bash
grep plan for view/rendering terms: component, screen, form, button, modal,
layout, dashboard, sidebar, nav, dialog
# Require 2+ matches
```

**DX Scope 检测**：
```bash
grep plan for developer-facing terms: API, endpoint, REST, GraphQL, gRPC,
webhook, CLI, command, flag, SDK, library, package, npm, pip, SKILL.md...
# Also trigger if: product IS a developer tool OR AI agent is primary user
```

**Restore Point**：
在开始任何工作前，保存 plan 文件的当前状态到外部文件，以便回滚。

### 3.6 Dual Voices（双声音）

CEO 和 Design 阶段总是运行双声音：**Claude subagent**（Agent Tool）+ **Codex**（Bash）：

```bash
# Codex CEO voice
codex exec "You are a CEO/founder advisor reviewing a development plan.
Challenge the strategic foundations..." -C "$_REPO_ROOT" -s read-only

# Claude CEO subagent
Agent tool: "Read the plan file. You are an independent CEO/strategist..."
```

错误处理降级矩阵：
- 双失败 → "single-reviewer mode"
- 仅 Codex → tag `[codex-only]`
- 仅 subagent → tag `[subagent-only]`

---

## 4. Review Army 深度流程

### 4.1 四步流程总览

Review Army 的完整流程：

```
Step 4.5: Specialist Selection
    ├── Detect stack and scope
    ├── Read specialist hit rates
    ├── Select specialists (always-on + conditional)
    └── Apply adaptive gating

Step 4.6: Specialist Dispatch (parallel)
    └── Launch all specialists via Agent tool (foreground)

Step 4.7: Findings Merge
    ├── Parse JSON outputs
    ├── Fingerprint deduplication
    ├── Multi-specialist confirmation (+1 confidence)
    ├── Confidence gates
    └── PR Quality Score calculation

Step 4.8: Red Team (conditional)
    └── If DIFF_LINES > 200 OR CRITICAL findings exist
```

### 4.2 Specialist Selection 详解

**Always-on 专家**（50+ 变更行时始终分派）：
- Testing Specialist
- Maintainability Specialist

**Conditional 专家**（scope 匹配时）：

| 专家 | 触发条件 |
|------|----------|
| Security | `SCOPE_AUTH=true` OR (`SCOPE_BACKEND=true` AND `DIFF_LINES > 100`) |
| Performance | `SCOPE_BACKEND=true` OR `SCOPE_FRONTEND=true` |
| Data Migration | `SCOPE_MIGRATIONS=true` |
| API Contract | `SCOPE_API=true` |
| Design | `SCOPE_FRONTEND=true` |

### 4.3 自适应门控详解

adaptive gating 读取 `gstack-specialist-stats` 输出：

```bash
${ctx.paths.binDir}/gstack-specialist-stats 2>/dev/null
```

输出格式示例：
```
[SPECIALIST:security] dispatched:12 findings:2 → [GATE_CANDIDATE]
[SPECIALIST:testing] dispatched:15 findings:8 → [NEVER_GATE]
[SPECIALIST:data-migration] dispatched:5 findings:0 → [SCOPE_SKIP]
```

门控规则：
- `[GATE_CANDIDATE]`（0 发现 in 10+ 分派）→ 跳过
- `[NEVER_GATE]` → 永不门控（Security 和 data-migration 是保险策略专家）
- 强制标志（`--security`、`--all-specialists`）→ 绕过门控

### 4.4 Specialist Dispatch 详解

每个专家 subagent 接收的 prompt 包含：

1. **checklist 内容**（从 specialist 文件读取）
2. **Stack context**：`"This is a {STACK} project."`
3. **Past learnings**：

```bash
${ctx.paths.binDir}/gstack-learnings-search --type pitfall --query "{domain}" --limit 5
```

4. **JSON 输出格式**：

```json
{
  "severity": "CRITICAL|INFORMATIONAL",
  "confidence": 9,
  "path": "src/handler.ts",
  "line": 42,
  "category": "security",
  "summary": "SQL injection via string interpolation",
  "fix": "Use parameterized query",
  "fingerprint": "src/handler.ts:42:sql-injection",
  "specialist": "security",
  "test_stub": "..." // 可选
}
```

### 4.5 Findings Merge 详解

**指纹去重**：
```
fingerprint = fingerprint 字段 OR "{path}:{line}:{category}"
```

多专家确认时：
- 保留最高置信度
- tag: "MULTI-SPECIALIST CONFIRMED (security + eng)"
- confidence +1（上限 10）

**置信度门控**：

| 置信度 | 显示规则 |
|--------|----------|
| 7+ | 正常显示 |
| 5-6 | 带 caveat 显示 |
| 3-4 | 仅在 appendix |
| 1-2 | 完全压制 |

**PR Quality Score**：

```
quality_score = max(0, 10 - (critical_count * 2 + informational_count * 0.5))
上限: 10
```

### 4.6 Red Team 详解

**触发条件**：
- `DIFF_LINES > 200` OR
- 任何专家产生 CRITICAL 发现

Red Team subagent 接收：
1. Red Team checklist
2. 已合并的专家发现（知道哪些已经被捕获）
3. git diff 命令

目标：**找专家们遗漏的**——跨领域问题、集成边界问题、专家 checklist 不覆盖的失败模式。

---

## 5. 置信度校准

### 5.1 置信度 rubric

每个发现必须包含 1-10 置信度分数：

| 分数 | 含义 | 显示规则 |
|------|------|----------|
| 9-10 | 通过阅读具体代码验证。 Concrete bug 或 exploit 已演示。 | 正常显示 |
| 7-8 | 高置信度模式匹配。很可能正确。 | 正常显示 |
| 5-6 | 中等。可能误报。 | 带 caveat："中置信度，验证这是否真的是问题" |
| 3-4 | 低置信度。模式可疑但可能没问题。 | 仅在 appendix |
| 1-2 | 推测。仅在严重度 P0 时报告。 | 完全压制 |

### 5.2 发现格式

```
[P1] (confidence: 9/10) app/models/user.rb:42 — SQL injection via string interpolation
[P2] (confidence: 5/10) app/controllers/api/v1/users_controller.rb:18 — Possible N+1 query, verify with production logs
```

### 5.3 校准学习

如果报告了 <7 置信度的发现，但用户确认**确实是**问题——这是校准事件。初始置信度太低了。将纠正后的模式记录为 Learning，以便未来审查以更高置信度捕获。

---

## 6. 章节核心比喻

| 概念 | 比喻 | 说明 |
|------|------|------|
| autoplan | 自动驾驶 | 用户设定目的地（plan），系统自动执行全流程 |
| 6 Decision Principles | 宪法修正案 | 不可动摇的决策框架，约束所有自动决策 |
| User Challenge | 紧急刹车 | 即使 AI 一致同意，仍需人类最终确认 |
| Adaptive Gating | 选秀海选 | 长期无表现的选手被自动淘汰 |
| Multi-specialist Confirmation | 交叉举证 | 两个专家独立发现同一问题 → 置信度提升 |
| PR Quality Score | 信用评分 | 综合衡量 PR 整体质量 |

---

## 7. 章节大纲（草稿）

```
第6章：autoplan 与 review-army 深度解析

6.1 autoplan 全自动化审查
    6.1.1 6 条决策原则
    6.1.2 决策分类（Mechanical / Taste / User Challenge）
    6.1.3 四阶段顺序执行
    6.1.4 Dual Voices 架构
    6.1.5 Phase 0 摄入检查

6.2 Review Army 深度流程
    6.2.1 四步流程总览
    6.2.2 Specialist Selection 详解
    6.2.3 Adaptive Gating 算法
    6.2.4 Specialist Dispatch 机制
    6.2.5 Findings Merge 与 PQS 计算
    6.2.6 Red Team 触发与执行

6.3 置信度校准体系
    6.3.1 1-10 置信度 rubric
    6.3.2 校准学习机制
    6.3.3 低置信度发现处理

6.4 章节小结
```

---

## 8. 附录：关键代码片段索引

| 片段 | 文件:行号 |
|------|----------|
| 6 Decision Principles | `autoplan/SKILL.md.tmpl:~50` |
| Decision Classification | `autoplan/SKILL.md.tmpl:~70` |
| Sequential Execution Mandate | `autoplan/SKILL.md.tmpl:~100` |
| Phase 0 Intake | `autoplan/SKILL.md.tmpl:~150` |
| Phase 1 CEO Review | `autoplan/SKILL.md.tmpl:~200` |
| Dual Voices | `autoplan/SKILL.md.tmpl:~220` |
| Specialist Selection | `review-army.ts:~20` |
| Specialist Dispatch | `review-army.ts:~70` |
| Findings Merge | `review-army.ts:~140` |
| Red Team | `review-army.ts:~200` |
| Confidence Calibration | `confidence.ts:~15` |
