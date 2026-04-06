# 第6章：autoplan 与 review-army 深度解析

第5章我们深入了三大核心技能的实现。本章我们将聚焦两个**规模化 SKILL 实践**：

- **autoplan**：全自动化审查流水线，用 6 条决策原则替代 15-30 个中间问题
- **review-army 深度**：自适应门控、发现合并、置信度校准的完整机制

读完本章，你会理解 gstack 如何在大规模代码审查中实现**智能化调度**——让审查既全面又高效。

---

## 概述

本章我们将探索：

- **autoplan 全自动化审查**：6 条决策原则、决策分类、顺序执行
- **Review Army 四步流程**：Selection → Dispatch → Merge → Red Team
- **自适应门控算法**：基于历史命中率的智能专家调度
- **置信度校准体系**：发现的质量与覆盖率的平衡

---

## 6.1 autoplan 全自动化审查

### 6.1.1 定位：一键全审查

autoplan 是 gstack 的**自动驾驶模式**。想象你告诉导航仪"带我去目的地"，而不是一步一步问"下一个路口左转还是右转？"。autoplan 读取完整的 CEO、Design、Eng、DX 四层审查技能文件，按顺序执行——与手动运行每个技能同等深度，但所有中间 AskUserQuestion 用 6 条决策原则自动回答。

**触发场景**：
- 用户说 "auto review"、"autoplan"、"run all reviews"
- 用户有 plan 文件但不想回答 15-30 个中间问题

```bash
# 调用 autoplan
/autoplan
# 输出: One command. Rough plan in, fully reviewed plan out.
```

### 6.1.2 六条决策原则

autoplan 的核心是 **6 条决策宪法**——它们约束所有自动决策：

```markdown
1. **Choose completeness** — Ship the whole thing.
   Pick the approach that covers more edge cases.

2. **Boil lakes** — Fix everything in the blast radius.
   Auto-approve expansions that are in blast radius AND < 1 day CC effort.

3. **Pragmatic** — If two options fix the same thing, pick the cleaner one.
   5 seconds choosing, not 5 minutes.

4. **DRY** — Duplicates existing functionality? Reject. Reuse what exists.

5. **Explicit over clever** — 10-line obvious fix > 200-line abstraction.
   Pick what a new contributor reads in 30 seconds.

6. **Bias toward action** — Merge > review cycles > stale deliberation.
   Flag concerns but don't block.
```

**冲突解决**（上下文相关的平局决胜）：

| 阶段 | 主导原则 |
|------|----------|
| CEO phase | P1 (completeness) + P2 (boil lakes) |
| Eng phase | P5 (explicit) + P3 (pragmatic) |
| Design phase | P5 (explicit) + P1 (completeness) |

### 6.1.3 决策分类

每条自动决策被分为三类，处理方式截然不同：

| 分类 | 特征 | 处理方式 |
|------|------|----------|
| **Mechanical** | 唯一正确答案 | 静默自动决定 |
| **Taste** | 合理人会有分歧 | 自动决定，最终门控上浮 |
| **User Challenge** | 双模型同意用户方向应改 | **从不自动决定** |

**Taste 决策的三种自然来源**：

1. **Close approaches**：前两名都可行，各有权衡
2. **Borderline scope**：在 blast radius 边缘，3-5 个文件
3. **Codex disagreements**：Codex 推荐不同但有合理依据

**User Challenge 的特殊设计**：

当 Claude 和 Codex 都认为用户陈述的方向应该改变时，这是 User Challenge——**从不自动决定**。

User Challenge 需要更丰富的上下文：

```
┌─────────────────────────────────────────────────────────┐
│ USER CHALLENGE — 人类最终确认                             │
├─────────────────────────────────────────────────────────┤
│ What the user said: [原始方向]                           │
│ What both models recommend: [改变内容]                    │
│ Why: [模型的推理]                                        │
│ What context we might be missing: [明确承认盲点]           │
│ If we're wrong, the cost is: [代价]                      │
└─────────────────────────────────────────────────────────┘
```

例外：如果双模型都将改变标记为安全漏洞或可行性阻塞，AskUserQuestion 的措辞明确警告。但这仍是用户决定，只是措辞更紧迫。

### 6.1.4 顺序执行（强制）

autoplan 严格按**强制顺序**执行四阶段——每一层建立在上一层之上：

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

**从不当并行执行**——如果 Design 阶段发现的问题影响 CEO 阶段的范围决策，并行执行会导致不一致。顺序执行确保每一层的输出是下一层的可靠输入。

### 6.1.5 Phase 0 摄入检查

Phase 0 三个关键检测决定后续阶段的 scope：

**UI Scope 检测**：
```bash
grep plan for: component, screen, form, button, modal,
layout, dashboard, sidebar, nav, dialog
# Require 2+ matches → UI scope = true
```

**DX Scope 检测**：
```bash
grep plan for: API, endpoint, REST, GraphQL, gRPC,
webhook, CLI, command, SDK, package, npm, pip, SKILL.md...
# Also trigger if: product IS a developer tool
```

**Restore Point**：
在开始任何工作前，保存 plan 文件到外部文件：

```bash
# 保存 restore point
cp $PLAN_FILE $HOME/.gstack/projects/$SLUG/${BRANCH}-autoplan-restore-${DATETIME}.md

# 在 plan 文件中记录 restore path
<!-- /autoplan restore point: /path/to/restore.md -->
```

这确保如果 autoplan 把事情搞砸，用户可以一键回滚。

### 6.1.6 Dual Voices 架构

CEO 和 Design 阶段总是运行**双声音**——Claude subagent（Agent Tool）+ Codex（Bash）：

```typescript
// [autoplan/SKILL.md.tmpl:~220] Dual Voices
// Run them sequentially in foreground. First Claude subagent, then Codex.
// Both must complete before building the consensus table.
```

**Claude CEO subagent**（Agent Tool）：
> "Read the plan file. You are an independent CEO/strategist... Evaluate: Is this the right problem? What's the 6-month regret? What alternatives were dismissed?"

**Codex CEO voice**（Bash）：
```bash
codex exec "You are a CEO/founder advisor reviewing a development plan.
Challenge the strategic foundations..." -C "$_REPO_ROOT" -s read-only
```

**共识表**：

```
CEO DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Consensus
  ─────────────────────────────────── ─────── ─────── ─────────
  1. Premises valid?                   —       —      —
  2. Right problem to solve?           —       —      —
  3. Scope calibration correct?       —       —      —
  4. Alternatives sufficiently explored?—      —      —
  5. Competitive/market risks covered?—       —      —
  6. 6-month trajectory sound?        —       —      —
═══════════════════════════════════════════════════════════════
CONFIRMED = both agree. DISAGREE = models differ → taste decision.
```

---

## 6.2 Review Army 四步深度流程

### 6.2.1 流程总览

Review Army 的完整四步流程：

```
Step 4.5: Specialist Selection
    ├── Detect stack and scope
    ├── Read specialist hit rates (adaptive gating)
    └── Select + gate specialists

Step 4.6: Specialist Dispatch (parallel)
    └── Launch ALL via Agent tool (foreground, not background)

Step 4.7: Findings Merge
    ├── Parse JSON outputs
    ├── Fingerprint deduplication
    ├── Multi-specialist confirmation
    ├── Confidence gates
    └── PR Quality Score calculation

Step 4.8: Red Team (conditional)
    └── If DIFF_LINES > 200 OR CRITICAL findings exist
```

### 6.2.2 Specialist Selection

**Always-on 专家**（50+ 变更行时始终分派）：
- Testing Specialist → 读取 `review/specialists/testing.md`
- Maintainability Specialist → 读取 `review/specialists/maintainability.md`

**Conditional 专家**（scope 匹配时）：

| 专家 | 触发条件 |
|------|----------|
| Security | `SCOPE_AUTH=true` OR (`SCOPE_BACKEND=true` AND `DIFF_LINES > 100`) |
| Performance | `SCOPE_BACKEND=true` OR `SCOPE_FRONTEND=true` |
| Data Migration | `SCOPE_MIGRATIONS=true` |
| API Contract | `SCOPE_API=true` |
| Design | `SCOPE_FRONTEND=true` |

```bash
# [review-army.ts:~20] Stack detection
source <(${ctx.paths.binDir}/gstack-diff-scope <base>)
STACK=""
[ -f Gemfile ] && STACK="${STACK}ruby "
[ -f package.json ] && STACK="${STACK}node "
# ...
echo "STACK: ${STACK:-unknown}"
DIFF_LINES=$(git diff origin/<base> --stat | tail -1 | grep -oE '[0-9]+' || echo "0")
```

### 6.2.3 自适应门控算法

adaptive gating 是 Review Army 的**自我优化机制**——它让专家调度随时间改进：

```bash
# [review-army.ts:~20] 读取专家命中率
${ctx.paths.binDir}/gstack-specialist-stats 2>/dev/null
```

输出格式示例：
```
[SPECIALIST:security] dispatched:12 findings:2 → [GATE_CANDIDATE]
[SPECIALIST:testing] dispatched:15 findings:8 → [NEVER_GATE]
```

**门控规则**：

| 标签 | 含义 | 行为 |
|------|------|------|
| `[GATE_CANDIDATE]` | 0 发现 in 10+ 分派 | 跳过 |
| `[NEVER_GATE]` | 永不门控 | 始终分派 |
| scope skip | scope 不匹配 | 跳过 |

**强制标志**：`--security`、`--all-specialists` 等标志绕过门控。

### 6.2.4 Specialist Dispatch

每个专家 subagent 以**并行**方式启动——所有专家同时运行，互不阻塞：

```typescript
// [review-army.ts:~70] 并行分派
// Launch ALL selected specialists in a single message
// (multiple Agent tool calls) so they run in parallel
// Each subagent has fresh context — no prior review bias
```

每个 subagent 接收的 prompt 包含：

1. **checklist 内容**（从 specialist 文件读取）
2. **Stack context**：`"This is a {STACK} project."`
3. **Past learnings**：

```bash
${ctx.paths.binDir}/gstack-learnings-search --type pitfall --query "{domain}" --limit 5
```

4. **JSON 输出格式要求**：

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
  "specialist": "security"
}
```

### 6.2.5 Findings Merge 与 PQS 计算

发现合并是 Review Army 的**聚变反应**——多个专家的独立发现汇聚成统一报告：

**指纹去重**：
```typescript
// 优先使用显式 fingerprint 字段
// 否则: "{path}:{line}:{category}"
fingerprint = fingerprint_field || `${path}:${line}:${category}`
```

**多专家确认**：
当两个专家独立发现同一问题（相同 fingerprint）：
- 保留最高置信度
- confidence +1（上限 10）
- tag: "MULTI-SPECIALIST CONFIRMED (security + eng)"

**PR Quality Score（PQS）**：

```
quality_score = max(0, 10 - (critical_count * 2 + informational_count * 0.5))
上限: 10
```

| PQS | 含义 |
|-----|------|
| 9-10 | 优秀，几乎无问题 |
| 7-8 | 良好，少量可改进 |
| 5-6 | 一般，需要关注 |
| 3-4 | 较差，建议延迟合并 |
| 0-2 | 严重问题，必须修复 |

### 6.2.6 Red Team

Red Team 是 Review Army 的**特种部队**——在最需要的时候介入：

**触发条件**：
- `DIFF_LINES > 200` **OR**
- 任何专家产生 CRITICAL 发现

```typescript
// [review-army.ts:~200] Red Team dispatch
// Activation: Only if DIFF_LINES > 200 OR any specialist produced CRITICAL
```

Red Team subagent 的独特之处：它知道专家们**已经捕获了什么**，因此专注于**找遗漏**：

- 跨领域问题（单个专家 checklist 不覆盖）
- 集成边界问题
- 失败模式（专家从不同角度可能遗漏）

---

## 6.3 置信度校准体系

### 6.3.1 1-10 置信度 rubric

每个发现必须包含 **1-10 置信度分数**。这平衡了**精确性**（只报告高置信度发现）与**覆盖率**（不遗漏潜在问题）：

| 分数 | 含义 | 显示规则 |
|------|------|----------|
| **9-10** | 通过阅读具体代码验证。Concrete bug 或 exploit 已演示。 | 正常显示 |
| **7-8** | 高置信度模式匹配。很可能正确。 | 正常显示 |
| **5-6** | 中等。可能误报。 | 带 caveat："中置信度，验证这是否真的是问题" |
| **3-4** | 低置信度。模式可疑但可能没问题。 | 仅在 appendix |
| **1-2** | 推测。仅在严重度 P0 时报告。 | 完全压制 |

### 6.3.2 发现格式

```markdown
[P1] (confidence: 9/10) app/models/user.rb:42 — SQL injection via string interpolation in where clause
[P2] (confidence: 5/10) app/controllers/api/v1/users_controller.rb:18 — Possible N+1 query, verify with production logs
```

### 6.3.3 校准学习

如果报告了 <7 置信度的发现，但用户确认**确实是**问题——这是**校准事件**：

```
Initial confidence was too low → Log the corrected pattern as a Learning
→ Future reviews catch it with higher confidence
```

这让 Review Army 随时间**变聪明**——每次校准事件都是一次学习。

---

## 6.4 本章小结

本章我们深入了 autoplan 和 review-army 的深度机制：

1. **autoplan 全自动化审查**：6 条决策原则作为宪法约束，决策分为 Mechanical/Taste/User Challenge 三类，强制顺序执行确保层级一致性
2. **Review Army 四步流程**：Selection → Dispatch → Merge → Red Team，每步都有明确的职责和交互协议
3. **自适应门控算法**：基于 `gstack-specialist-stats` 的历史数据，自动淘汰无效专家，让调度随时间优化
4. **置信度校准体系**：1-10 分数平衡精确性与覆盖率，校准学习让系统持续改进

这三章（ch04-ch06）完整覆盖了 SKILL 系统的设计哲学：模板化的可维护性、运行时的灵活性、大规模并行化的效率。

下一批（ch07-ch10）我们将探索 **Host 适配层**、**8 大 AI 代理支持**、**安全机制**和**构建发布**。

---

| 组件 | 源码位置 | 核心概念 |
|------|----------|----------|
| 6 Decision Principles | `autoplan:~50` | 决策宪法 |
| Decision Classification | `autoplan:~70` | Mechanical/Taste/User Challenge |
| Specialist Selection | `review-army.ts:~20` | Always-on + Conditional |
| Adaptive Gating | `review-army.ts:~40` | 命中率追踪 |
| Findings Merge | `review-army.ts:~140` | 指纹去重 + PQS |
| Red Team | `review-army.ts:~200` | 特种部队触发 |
| Confidence Calibration | `confidence.ts:~15` | 1-10 rubric |
