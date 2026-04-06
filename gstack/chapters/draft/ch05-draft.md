# 第5章：核心技能解析——/plan、/review、/ship

第4章我们理解了 SKILL 系统的三层架构：模板编译、前导脚本注入、专家分派。本章我们将深入**三大核心技能的实现**，看看它们如何利用底层机制构建出完整的工作流程。

gstack 的技能不是孤立的——它们互相引用、层层递进。当你在终端输入 `/review` 时，背后是 Review Readiness Dashboard、Review Army、Learnings 系统等多个组件的协同。本章我们将揭开这些技能的实现细节。

---

## 概述

本章我们将探索：

- **审查分层体系**：五层审查架构与 Review Readiness Dashboard
- **plan 技能系列**：eng/design/devex/ceo 四维审查
- **Spec 审查循环**：Fix-First 流程与收敛守卫
- **Learnings 制度记忆**：跨会话积累的制度性知识
- **技能串联机制**：`{{INVOKE_SKILL}}` 与 Benefits From

---

## 5.1 审查分层体系

### 5.1.1 Review Readiness Dashboard

想象你走进机场安检大厅，抬头看电子屏：所有航班的值机、安检、登机状态一目了然。gstack 的 **Review Readiness Dashboard** 就是这个电子屏——它实时展示所有审查的通过状态。

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

仪表板的数据来自 `~/.gstack/reviews/review-log.jsonl`，每次审查完成后都会写入日志条目。

```bash
# [review.ts:~45] 调用仪表板
~/.claude/skills/gstack/bin/gstack-review-read
```

仪表板读取 JSONL 日志，过滤 7 天内的记录，按技能分组展示。同一技能可能有多个来源（如 `review` 和 `plan-eng-review` 都提供 Eng Review），取最新的。

### 5.1.2 五层审查架构

gstack 实现了**五层审查体系**，每层守不同的关卡：

| 审查层 | 技能 | 是否门控 | 职责 |
|--------|------|---------|------|
| **Eng Review** | `/review` 或 `/plan-eng-review` | **唯一门控** | 架构、代码质量、测试 |
| **CEO Review** | `/plan-ceo-review` | 否 | 产品方向、范围决策 |
| **Design Review** | `/plan-design-review` | 否 | UI/UX、设计系统 |
| **Adversarial** | `/adversarial-review` | 否 | 对抗性攻击（常驻） |
| **Outside Voice** | `/codex-plan-review` | 否 | 独立 AI 二审 |

**关键洞察**：Eng Review 是唯一门控发布的审查层。其他四层都是可选的——它们提供额外视角，但不阻塞发布。这意味着 gstack 的哲学是**信任工程师的架构决策**，但在质量测试上不妥协。

### 5.1.3 陈旧性检测

审查通过了就永远有效吗？当然不是。代码在演进，审查会**陈旧**（stale）。

```bash
# [review.ts:~45] 陈旧性检测
git rev-list --count STORED_COMMIT..HEAD
```

Dashboard 会比较当前 HEAD 与审查时的 commit。如果审查后有 10+ 个新提交，输出：

> "Note: Eng Review from 2026-03-16 may be stale — 12 commits since review"

这个机制确保工程师不会因为"之前审查过了"而跳过必要的复审。

---

## 5.2 plan 技能系列

### 5.2.1 plan-eng-review：工程审查

**职责**：在计划阶段审查架构设计，确保实现路径正确。

核心 resolver：`testing.ts` 中的 `generateTestCoverageAuditInner('plan')`

覆盖审计三步法：

**Step 1: 追踪每个代码路径**

不是列出计划中的函数，而是真正**追踪数据流**：

```typescript
// 从 plan 文档中提取计划组件
// 对每个组件：
// 1. 数据从哪里来？（请求参数、props、数据库、API 调用）
// 2. 经历什么转换？（验证、映射、计算）
// 3. 最终去哪里？（数据库写入、API 响应、渲染输出、副作用）
// 4. 每一步可能出错？（null/undefined、非法输入、网络失败、空集合）
```

**Step 2: 映射用户流程**

代码覆盖率不够——还要覆盖**真实用户交互**：

- 用户flows：完整旅程的每一步都需要测试
- 交互边界case：快速重复点击、页面停留 30 分钟后退回、网络慢场景
- 错误状态：用户看到什么错误？能恢复吗？
- 边界状态：零结果？10000 结果？单字符输入？

**Step 3: 对照现有测试（质量评分 rubric）**

| 评分 | 含义 |
|------|------|
| ★★★ | 测试行为 + 边界 case + 错误路径 |
| ★★ | 测试正确行为，happy path only |
| ★ | 冒烟测试（"it renders", "it doesn't throw"） |

### 5.2.2 plan-design-review：设计审查

**职责**：系统性地审查 UI/UX 设计质量，从直觉反应到设计系统一致性。

核心 resolver：`design.ts` 中的 `generateDesignMethodology()`

设计审查分五阶段：

```
Phase 1: First Impression
    ↓
Phase 2: Design System Extraction
    ↓
Phase 3: Page-by-Page Visual Audit
    ↓
Phase 4: Interaction Flow Review
    ↓
Phase 5: Cross-Page Consistency
```

**Phase 1: First Impression**

最有设计师特色的输出。在分析任何东西之前形成直觉反应：

```markdown
- "The site communicates [what]."
- "I notice [observation]."
- "The first 3 things my eye goes to are: [1], [2], [3]."
- "If I had to describe this in one word: [word]."
```

**Phase 2: Design System Extraction**

提取实际使用的设计系统，而非文档声称的系统：

```bash
# 提取字体（在用字体列表）
$B js "JSON.stringify([...new Set([...document.querySelectorAll('*')].slice(0,500).map(e => getComputedStyle(e).fontFamily))])"

# 提取颜色调色板
$B js "JSON.stringify([...new Set([...document.querySelectorAll('*')].slice(0,500).flatMap(e => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor]).filter(c => c !== 'rgba(0, 0, 0, 0)'))])"

# 触摸目标审计（查找尺寸不足的可交互元素）
$B js "JSON.stringify([...document.querySelectorAll('a,button,input,[role=button]')].filter(e => {const r=e.getBoundingClientRect(); return r.width>0 && (r.width<44||r.height<44)}).map(e => ({tag:e.tagName, text:(e.textContent||'').trim().slice(0,30), w:Math.round(e.getBoundingClientRect().width), h:Math.round(e.getBoundingClientRect().height)})).slice(0,20))"
```

**Phase 3: Page-by-Page Visual Audit（10 类别 ~80 条）**

这是最重量级的审查，涵盖十大类别：

| 类别 | 条目数 | 关键检查项 |
|------|--------|-----------|
| Visual Hierarchy & Composition | 8 | 焦点清晰？信息密度合适？ |
| Typography | 15 | 字体数 ≤3？行高 1.5x？无字母间距在 lowercase？ |
| Color & Contrast | 10 | WCAG AA 合规？无纯色编码？ |
| Spacing & Layout | 12 | 间距使用比例尺？无横向滚动？ |
| Interaction States | 10 | hover/focus/active/disabled 状态完整？ |
| Responsive Design | 8 | 移动端布局合理？触摸目标 ≥44px？ |
| Motion & Animation | 6 | 缓动曲线正确？`prefers-reduced-motion` 尊重？ |
| Content & Microcopy | 8 | 空状态有温度？错误消息包含修复指引？ |
| AI Slop Detection | 10 | 无模板化设计反模式？ |
| Performance as Design | 6 | LCP < 2.0s？无字体闪变？ |

### 5.2.3 plan-devex-review：开发者体验

**职责**：评估开发者工具链质量，关注 Time to Hello World（TTHW）。

核心 resolver：`dx.ts` 中的 `generateDxFramework()`

**DX 第一性原理**（八条铁律）：

1. **T0 零摩擦**：前五分钟决定一切，一键启动，无需文档即可 hello world
2. **增量步骤**：永远不让开发者理解全系统后才从一部分获得价值
3. **边做边学**：playground、沙盒、上下文中的代码示例
4. **替我做决定，但让我覆盖**：固执己见的默认值是功能，逃生舱是必需
5. **对抗不确定性**：开发者需要：下一步做什么、是否成功、失败如何修复
6. **展示上下文中的代码**：hello world 是谎言，展示真实 auth、真实错误处理
7. **速度是功能**：迭代速度是一切
8. **创造魔法时刻**：什么会感觉像魔法？

**七大 DX 特性评分**：

| # | 特性 | 含义 | 金标准 |
|---|------|------|--------|
| 1 | Usable | 简单安装/设置/使用 | Stripe: one key, one curl |
| 2 | Credible | 可靠、可预测、清晰废弃 | TypeScript: 从不破坏 JS |
| 3 | Findable | 容易发现和找到帮助 | React: 每个问题在 Stack Overflow |
| 4 | Useful | 解决真实问题，覆盖真实用例 | Tailwind: 覆盖 95% CSS 需求 |
| 5 | Valuable | 减少摩擦，可衡量 | Next.js: SSR+路由+bundling+部署 |
| 6 | Accessible | 跨角色/环境/偏好工作 | VS Code: junior 到 principal 都能用 |
| 7 | Desirable | 最佳技术，合理价格 | Vercel: 开发者想要用它，不是忍受 |

**TTHW 基准**：

| 级别 | 时间 | 采纳影响 |
|------|------|----------|
| Champion | < 2 min | 3-4x 更高采纳率 |
| Competitive | 2-5 min | 基准线 |
| Needs Work | 5-10 min | 显著流失 |
| Red Flag | > 10 min | 50-70% 放弃 |

### 5.2.4 plan-ceo-review：战略视角

**职责**：产品方向、范围决策、独立 AI 二审。

包含 **Phase 3.5: Cross-Model Second Opinion**——调用 Codex 作为第二意见。

```bash
# [review.ts:~300] Codex 第二意见
TMPERR=$(mktemp /tmp/codex-oh-XXXXXXXX)
codex exec "Review the problem statement..." -C "$_REPO_ROOT" -s read-only
cat "$TMPERR" && rm -f "$TMPERR"
```

Startup 模式与 Builder 模式有不同的指令模板：

- **Startup 模式**：战略建议、独立技术顾问视角
- **Builder 模式**：实现路径、工程可行性视角

---

## 5.3 Spec 审查循环

### 5.3.1 Fix-First 流程

当你写完一个设计文档或规格说明，gstack 会运行 **Spec 审查循环**——一个三迭代的对抗性审查流程：

```
dispatch reviewer subagent
    ↓
┌─ NO issues ──→ PASS，报告质量分数
└─ YES issues
      ↓
    Fix in doc
      ↓
re-dispatch reviewer
      ↓
┌─ 收敛？────┐
│  (连续相同问题)
│ NO ─→ 最多 3 次
│ YES ─→ 收敛守卫
```

```typescript
// [review.ts:~180] Spec Review Loop
// Step 1: Dispatch reviewer subagent
// - 独立 Agent，无前序对话上下文
// - 仅读取文档文件
// - 五维质量评估

// Step 2: Fix and re-dispatch
// - 最多 3 次迭代
// - 收敛守卫：如果相邻迭代返回相同问题 → 停止

// Step 3: Report and persist
// - 报告结果（摘要）
// - 未解决项写入 "Reviewer Concerns"
// - 指标写入 ~/.gstack/analytics/spec-review.jsonl
```

### 5.3.2 五维质量评估

审查 subagent 从五个维度评估文档：

| 维度 | 核心问题 |
|------|----------|
| **Completeness** | 所有需求都覆盖了？边界 case 缺失？ |
| **Consistency** | 文档各部分一致？有矛盾？ |
| **Clarity** | 工程师能否无需提问实现？语言歧义？ |
| **Scope** | 超出原始问题？YAGNI 违规？ |
| **Feasibility** | 用所述方案能实际构建？隐藏复杂度？ |

### 5.3.3 收敛守卫机制

收敛守卫（convergence guard）防止无限循环：

> 如果相邻两次迭代返回**相同问题**（修复未解决问题，或 reviewer 不同意修复），停止循环，将问题标记为 "Reviewer Concerns"。

这比硬性限制（"最多 3 次"）更智能——它识别出真正无法收敛的情况。

---

## 5.4 Learnings 制度记忆

### 5.4.1 跨会话知识积累

gstack 的 **Learnings 系统**是整个流水线中最具"学习能力"的设计。它让 gstack 随时间变聪明——每一次审查中发现的问题模式，都可能被未来会话利用。

```
当前会话发现
    ↓
~/.gstack/projects/{slug}/learnings.jsonl
    ↓
gstack-learnings-search 查询
    ↓
未来会话读取
    ↓
"Prior learning applied: [key] (confidence 8/10, from 2026-03-10)"
```

每条 Learning 是 JSONL 行，包含类型、关键信息、置信度、来源：

```json
{
  "skill": "review",
  "type": "pitfall",
  "key": "auth-token-header-missing",
  "insight": "在 API handler 中未校验 Authorization header 导致 token 泄露",
  "confidence": 8,
  "source": "observed",
  "files": ["src/handlers/api.ts"]
}
```

**类型分类**：`pattern`（可复用方法）| `pitfall`（不要做什么）| `preference`（用户偏好）| `architecture`（架构决策）| `tool`（工具洞察）| `operational`（项目环境知识）

**来源分类**：`observed`（代码中发现）| `user-stated`（用户告知）| `inferred`（AI 推断）| `cross-model`（Claude + Codex 一致）

### 5.4.2 置信度诚实原则

Learnings 系统要求**诚实的置信度**：

| 置信度 | 场景 |
|--------|------|
| 8-9 | 代码中验证的模式（你 read 了源码确认） |
| 4-5 | 未确认的推断 |
| 10 | 用户明确陈述的偏好 |

### 5.4.3 跨项目学习

默认情况下，Learnings 仅搜索当前项目。通过 AskUserQuestion 询问用户：

> "gstack can search learnings from your other projects on this machine to find patterns that might apply here. This stays local (no data leaves your machine)."

这对于独立开发者（跨多个项目工作）尤其有价值。偏好通过 `gstack-config` 持久化存储。

---

## 5.5 技能串联机制

### 5.5.1 `{{INVOKE_SKILL}}` 解析器

技能之间不是孤立的——`{{INVOKE_SKILL}}` 实现了**接力棒传递**：

```typescript
// [composition.ts:~15] INVOKE_SKILL 解析器
export function generateInvokeSkill(ctx: TemplateContext, args?: string[]): string {
  const skillName = args?.[0]; // e.g., "plan-eng-review"

  // 支持 skip= 参数
  const extraSkips = args?.slice(1)
    .filter(a => a.startsWith('skip='))
    .flatMap(a => a.slice(5).split(','));

  const DEFAULT_SKIPS = [
    'Preamble (run first)',
    'AskUserQuestion Format',
    'Completeness Principle — Boil the Lake',
    // ... 9 more
  ];

  return `Read \`/${skillName}\` SKILL.md, skipping: [列表], then execute at full depth.`;
}
```

使用示例：`{{INVOKE_SKILL:plan-eng-review:skip=Outside Voice}}`

**跳过列表的设计理由**：被调用的技能有很多通用 section（Preamble、Telemetry 等），这些在父技能中已经处理。跳过它们避免重复执行，也避免上下文污染。

### 5.5.2 Benefits From 推荐链

`review.ts` 中的 `generateBenefitsFrom()` 实现了**前置技能推荐**：

```typescript
// 当缺少设计文档时
if (ctx.benefitsFrom?.length > 0) {
  AskUserQuestion: "No design doc found. Run /plan-eng-review first?
  Options: A) Run it now B) Skip — proceed with standard review"
}
```

如果用户选择 A：

```bash
# 运行前置技能
{{INVOKE_SKILL:plan-eng-review}}

# 前置技能完成后，复检设计文档
DESIGN=$(ls -t ~/.gstack/projects/$SLUG/*-$BRANCH-design-*.md | head-1)
if [ -n "$DESIGN" ]; then
  read $DESIGN
  continue review
fi
```

这形成了一个**技能推荐链**：当一个技能需要更好的输入时，它推荐并等待前置技能完成。

---

## 5.6 本章小结

本章我们深入了三大核心技能的实现：

1. **审查分层体系**：五层审查 + Review Readiness Dashboard + 陈旧性检测
2. **plan 技能系列**：eng（代码路径+测试）、design（80 条审查清单）、devex（DX 八律+TTHW）、ceo（战略+跨模型二审）
3. **Spec 审查循环**：Fix-First 三迭代 + 收敛守卫
4. **Learnings 制度记忆**：跨会话知识积累，置信度诚实原则
5. **技能串联机制**：INVOKE_SKILL 接力棒 + Benefits From 推荐链

下一章我们将聚焦 **autoplan** 与 **review-army 深度解析**——这两个组件是 SKILL 系统在大规模代码审查中的规模化实践。

---

| 组件 | 源码位置 | 核心概念 |
|------|----------|----------|
| Dashboard | `review.ts:~45` | 五层审查状态聚合 |
| Design Review | `design.ts:~50` | 五阶段设计审查方法论 |
| DX Framework | `dx.ts:~20` | DX 八律 + 七大特性 |
| Test Coverage | `testing.ts:~200` | 覆盖审计三步法 |
| Learnings | `learnings.ts` | 制度记忆、跨项目学习 |
| Composition | `composition.ts` | INVOKE_SKILL 串联 |
