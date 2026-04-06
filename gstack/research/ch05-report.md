# ch05 研究报告：核心技能解析——/plan、/review、/ship

> **批次**: Phase 3 第 2 批（ch04-ch06）
> **研究员**: Scriptorium Phase 3.9
> **研究日期**: 2026-04-06
> **状态**: ✅ 完成

---

## 1. 研究目标

本章聚焦三大核心技能的**源码级实现解析**：

1. **/plan 系列**（`plan-eng-review`, `plan-design-review`, `plan-devex-review`, `plan-ceo-review`）：计划阶段的多维度审查
2. **/review**：代码变更的后置审查（Review Army 入口）
3. **/ship**：端到端交付流水线

研究问题：

- plan 技能的审查层次如何划分？
- /review 如何与 Review Army 集成？
- /ship 如何串联 plan → review → learn → ship 全流程？
- Learnings 系统如何实现跨会话的制度记忆？

---

## 2. 核心源文件

| 文件路径 | 行数 | 职责 |
|----------|------|------|
| `scripts/resolvers/review.ts` | ~600+ | /review 仪表板、Plan 文件报告、Spec 审查循环、跨模型二审 |
| `scripts/resolvers/dx.ts` | ~200+ | DX 框架评分标准、TTHW 基准 |
| `scripts/resolvers/testing.ts` | ~800+ | 测试框架引导、覆盖率审计 |
| `scripts/resolvers/design.ts` | ~600+ | 设计审查清单（80+ 条目）、Phase 1-5 方法论 |
| `scripts/resolvers/learnings.ts` | ~97 | Learnings 搜索与日志记录 |
| `scripts/resolvers/composition.ts` | ~48 | 技能串联（`{{INVOKE_SKILL}}`） |

---

## 3. Review Readiness Dashboard

### 3.1 审查分层架构

gstack 实现了**五层审查体系**，每层有明确的职责和门控关系：

| 审查层 | 技能 | 是否门控发布 | 触发方式 |
|--------|------|-------------|----------|
| **Eng Review** | `/review` 或 `/plan-eng-review` | **是**（唯一门控） | 自动/按需 |
| **CEO Review** | `/plan-ceo-review` | 否 | 按需 |
| **Design Review** | `/plan-design-review` | 否 | 按需 |
| **Adversarial** | `/adversarial-review` | 否 | 自动（常驻） |
| **Outside Voice** | `/codex-plan-review` | 否 | 按需（plan 技能后） |

### 3.2 仪表板输出格式

```bash
# 调用 gstack-review-read 获取审查状态
~/.claude/skills/gstack/bin/gstack-review-read
```

仪表板以表格形式展示（[review.ts:~45]）：

```
+====================================================================+
|                    REVIEW READINESS DASHBOARD                       |
+====================================================================+
| Review          | Runs | Last Run            | Status    | Required |
|-----------------|------|---------------------|-----------|----------|
| Eng Review      |  1   | 2026-03-16 15:00    | CLEAR     | YES      |
| CEO Review      |  0   | —                   | —         | no       |
| Design Review   |  0   | —                   | —         | no       |
| Adversarial     |  0   | —                   | —         | no       |
| Outside Voice   |  0   | —                   | —         | no       |
+--------------------------------------------------------------------+
| VERDICT: CLEARED — Eng Review passed                                |
+====================================================================+
```

### 3.3 陈旧性检测

仪表板还会检测审查的**陈旧性（staleness）**：

```typescript
// 比较当前 HEAD 与审查时的 commit
git rev-list --count STORED_COMMIT..HEAD
```

如果发现审查后有新提交，输出：
> "Note: Eng Review from 2026-03-16 may be stale — 12 commits since review"

---

## 4. Plan 技能系列

### 4.1 plan-eng-review：工程审查

核心职责：架构设计、代码质量、测试覆盖。

**核心 resolver：** `testing.ts` 中的 `generateTestCoverageAuditInner('plan')`

覆盖审计三步法：

1. **追踪每个代码路径**（从 plan 文档）
2. **映射用户流程**（交互边 case、错误状态）
3. **对照现有测试**（用质量评分 rubric）

质量评分 rubric：
- ★★★  测试行为 + 边界 case + 错误路径
- ★★   测试正确行为，仅 happy path
- ★    冒烟测试（"it renders", "it doesn't throw"）

### 4.2 plan-design-review：设计审查

核心职责：UI/UX 可访问性、设计系统一致性。

**核心 resolver：** `design.ts` 中的 `generateDesignMethodology()`

设计审查五阶段：

| Phase | 内容 |
|-------|------|
| **Phase 1** | First Impression — 直觉反应 |
| **Phase 2** | Design System Extraction — 提取实际设计系统 |
| **Phase 3** | Page-by-Page Visual Audit — 逐页审查（10 类别 ~80 条） |
| **Phase 4** | Interaction Flow Review — 交互流程体验 |
| **Phase 5** | Cross-Page Consistency — 跨页一致性 |

**Phase 3 十大审查类别**（[design.ts:~150]）：

1. Visual Hierarchy & Composition（8 条）
2. Typography（15 条）
3. Color & Contrast（10 条）
4. Spacing & Layout（12 条）
5. Interaction States（10 条）
6. Responsive Design（8 条）
7. Motion & Animation（6 条）
8. Content & Microcopy（8 条）
9. AI Slop Detection（10 条黑名单）
10. Performance as Design（6 条）

### 4.3 plan-devex-review：开发者体验审查

核心职责：开发者工具链质量、Time to Hello World（TTHW）。

**核心 resolver：** `dx.ts` 中的 `generateDxFramework()`

**七大 DX 特性**：

| # | 特性 | 金标准 |
|---|------|--------|
| 1 | Usable | Stripe: one key, one curl, money moves |
| 2 | Credible | TypeScript: gradual adoption, never breaks JS |
| 3 | Findable | React: every question answered on SO |
| 4 | Useful | Tailwind: covers 95% of CSS needs |
| 5 | Valuable | Next.js: SSR, routing, bundling, deploy in one |
| 6 | Accessible | VS Code: works for junior to principal |
| 7 | Desirable | Vercel: devs WANT to use it, not tolerate it |

**TTHW 基准**：

| 级别 | 时间 | 采纳影响 |
|------|------|----------|
| Champion | < 2 min | 3-4x 更高采纳率 |
| Competitive | 2-5 min | 基准线 |
| Needs Work | 5-10 min | 显著流失 |
| Red Flag | > 10 min | 50-70% 放弃 |

### 4.4 plan-ceo-review：战略审查

核心职责：产品方向、范围决策、竞争定位。

包含 **Phase 3.5: Cross-Model Second Opinion**（[review.ts:~300]）：

- 调用 Codex 作为第二意见（独立 AI 视角）
- Startup 模式 vs Builder 模式不同指令模板
- 不门控发布，仅提供外部视角

---

## 5. Spec 审查循环

### 5.1 Fix-First 流程

gstack 实现了 **Spec 审查循环**（[review.ts:~180]），这是一个三迭代的对抗性审查流程：

```
dispatch reviewer subagent
    ↓
发现 issues?
    ├─ NO  → PASS，报告质量分数
    └─ YES → Fix → Re-dispatch
              ↓
            收敛?
              ├─ NO  → 最多 3 次迭代
              └─ YES → 收敛守卫：标记"Reviewer Concerns"
```

收敛守卫（convergence guard）：如果相邻两次迭代返回相同问题，说明修复未解决或 reviewer 不同意修复。此时停止循环，将问题标记为 "Reviewer Concerns"。

### 5.2 五维质量评估

| 维度 | 评估问题 |
|------|----------|
| **Completeness** | 所有需求都覆盖了？边界 case 缺失？ |
| **Consistency** | 文档各部分是否一致？有矛盾？ |
| **Clarity** | 工程师能否无需提问就实现？语言歧义？ |
| **Scope** | 超出原始问题？YAGNI 违规？ |
| **Feasibility** | 用所述方案能实际构建？隐藏复杂度？ |

---

## 6. Learnings 系统

### 6.1 制度记忆架构

Learnings 是 gstack 的**跨会话制度记忆**系统（[learnings.ts]）：

```
~/.gstack/projects/{slug}/learnings.jsonl
    ↓
gstack-learnings-search 查询
    ↓
最新胜出（latest winner per key+type）
    ↓
注入到 Agent 上下文
```

每条 Learning 是 JSONL 行，包含：

```json
{
  "ts": "2026-04-06T10:00:00Z",
  "skill": "review",
  "type": "pattern",
  "key": "auth-token-leak-pattern",
  "insight": "在 API handler 中未校验 Authorization header 导致 token 泄露",
  "confidence": 8,
  "source": "observed",
  "files": ["src/handlers/api.ts"]
}
```

### 6.2 类型与来源

**类型**：`pattern`（可复用方法）| `pitfall`（不要做什么）| `preference`（用户偏好）| `architecture`（架构决策）| `tool`（工具洞察）| `operational`（项目环境知识）

**来源**：`observed`（代码中发现）| `user-stated`（用户告知）| `inferred`（AI 推断）| `cross-model`（Claude + Codex 一致）

### 6.3 跨项目学习

默认仅搜索当前项目。通过 AskUserQuestion 询问用户是否启用跨项目学习：

> "gstack can search learnings from your other projects on this machine to find patterns that might apply here. This stays local (no data leaves your machine)."

偏好通过 `gstack-config` 持久化存储。

---

## 7. 技能串联机制

### 7.1 `{{INVOKE_SKILL}}` 解析器

`composition.ts` 中的 `generateInvokeSkill()` 实现了技能串联：

```typescript
// [composition.ts] 技能串联
export function generateInvokeSkill(ctx: TemplateContext, args?: string[]): string {
  const skillName = args?.[0];
  const extraSkips = (args?.slice(1) || [])
    .filter(a => a.startsWith('skip='))
    .flatMap(a => a.slice(5).split(','));

  const DEFAULT_SKIPS = [
    'Preamble (run first)',
    'AskUserQuestion Format',
    'Completeness Principle',
    'Search Before Building',
    // ... 9 more
  ];

  return `Read \`/${skillName}\` SKILL.md, skipping: [列表], then execute at full depth.`;
}
```

使用示例：`{{INVOKE_SKILL:plan-eng-review:skip=Outside Voice}}`

### 7.2 Benefits From 机制

`review.ts` 中的 `generateBenefitsFrom()` 实现前置技能推荐：

```typescript
// 当缺少前置设计文档时，推荐运行对应 plan 技能
if (ctx.benefitsFrom?.length > 0) {
  // 询问用户是否先运行前置技能
  // 选项 A) 运行前置技能
  // 选项 B) 跳过，继续标准审查
}
```

---

## 8. 章节核心比喻

| 概念 | 比喻 | 说明 |
|------|------|------|
| Review Readiness Dashboard | 安检大厅电子屏 | 实时显示所有审查的状态和有效性 |
| Five Review Layers | 五道防线 | 每道防线守不同关卡，Eng Review 是唯一门控 |
| Spec Review Loop | 同行评审 | 多轮迭代直到收敛或达到最大轮次 |
| Learnings System | 集体记忆 | 跨会话积累制度性知识 |
| INVOKE_SKILL | 接力棒传递 | 一个技能完成后交棒给下一个技能 |

---

## 9. 章节大纲（草稿）

```
第5章：核心技能解析——/plan、/review、/ship

5.1 审查分层体系
    5.1.1 Review Readiness Dashboard
    5.1.2 五层审查架构
    5.1.3 陈旧性检测机制

5.2 plan 技能系列
    5.2.1 plan-eng-review：工程审查
    5.2.2 plan-design-review：设计审查
    5.2.3 plan-devex-review：开发者体验
    5.2.4 plan-ceo-review：战略视角

5.3 Spec 审查循环
    5.3.1 Fix-First 流程
    5.3.2 五维质量评估
    5.3.3 收敛守卫机制

5.4 Learnings 制度记忆
    5.4.1 记忆存储架构
    5.4.2 类型与来源分类
    5.4.3 跨项目学习

5.5 技能串联机制
    5.5.1 INVOKE_SKILL 解析器
    5.5.2 Benefits From 推荐链

5.6 章节小结
```

---

## 10. 附录：关键代码片段索引

| 片段 | 文件:行号 |
|------|----------|
| Review Readiness Dashboard 模板 | `review.ts:~45` |
| Plan File Review Report | `review.ts:~120` |
| Spec Review Loop | `review.ts:~180` |
| Codex Second Opinion | `review.ts:~300` |
| DX Framework | `dx.ts:~20` |
| DX Scoring Rubric | `dx.ts:~80` |
| Test Coverage Audit Inner | `testing.ts:~200` |
| Design Methodology Phase 1-5 | `design.ts:~50` |
| AI Slop Detection Checklist | `design.ts:~150` |
| Learnings Search | `learnings.ts:~20` |
| Learnings Log | `learnings.ts:~60` |
| Invoke Skill Composer | `composition.ts:~15` |
