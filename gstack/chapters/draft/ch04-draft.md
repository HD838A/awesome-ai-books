# 第4章：SKILL.md 模板系统——Markdown 即配置

第3章我们探索了 gstack 的持久化浏览器核心实现，理解了 `$B` 命令的完整执行路径。本章我们将深入 gstack 的**技能（Skill）系统**——这是 gstack 与 AI Agent 交互的核心协议。

技能系统由三层组成：

- **模板编译层**（gen-skill-docs.ts）：将 `.tmpl` 源模板编译为 SKILL.md
- **前导脚本层**（preamble.ts）：每次技能执行前注入 Bash 环境检测代码
- **专家分派层**（review-army.ts）：多专家并行审查的协调机制

读完本章，你会理解一个 SKILL 文件从源码到运行时的完整生命周期。

---

## 概述

本章我们将探索：

- **模板编译管线**：`.tmpl` → SKILL.md 的编译过程与字段验证
- **前导脚本注入**：Preamble 如何让技能感知运行环境
- **多专家分派模式**：Review Army 如何实现并行审查
- **自适应门控**：基于命中率的智能专家调度

---

## 4.1 模板编译管线

### 4.1.1 从活字到成品

在传统出版业中，**活字印刷**（letterpress）是一种革命性的技术：每个汉字刻在单独的木块或金属块上，排版时像搭积木一样组合。gstack 的 SKILL.md 模板系统与此异曲同工——每个技能由一个 `.tmpl` 模板文件定义，通过编译管线生成最终的 `SKILL.md`。

```bash
# gstack 项目中的模板文件结构
skills/
├── _shared/
│   ├── preamble.tmpl      # 所有技能共享的前导脚本
│   └── shared-prompts.tmpl
├── review/
│   └── review.tmpl        # /review 技能的模板
├── plan/
│   └── plan.tmpl          # /plan 技能的模板
└── ship/
    └── ship.tmpl          # /ship 技能的模板
```

模板文件的格式是 Markdown，但包含了**占位符（Placeholder）**机制：

```markdown
# {{SKILL_NAME}}

{{DESCRIPTION}}

## Usage

{{USAGE_EXAMPLES}}

## Permissions

{{PERMISSIONS}}
```

`gen-skill-docs.ts` 是这个编译管线的核心脚本。它的职责是：

1. 读取 `.tmpl` 文件
2. 扫描所有 `{{PLACEHOLDER}}` 占位符
3. 从源码中动态解析占位符的值
4. 对字段长度进行 per-host 验证
5. 处理 Voice Trigger
6. 写入最终的 `SKILL.md`

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│  review.tmpl │ ──→ │ gen-skill-docs.ts │ ──→ │ SKILL.md   │
│  (.tmpl 源码) │     │     （编译器）      │     │ (成品文件)   │
└──────────────┘     └──────────────────┘     └─────────────┘
                           │
                           ├── 扫描 {{PLACEHOLDER}}
                           ├── 解析占位符值
                           ├── AI Slop 检测
                           ├── Voice Trigger 处理
                           └── per-host 字段验证
```

### 4.1.2 per-host 字段验证

gstack 支持 8 种不同的 Host（AI 编程工具），每种 Host 对 SKILL.md 字段长度有不同的限制。例如，OpenAI 的 description 限制为 2000 字符，而 Claude Desktop 的限制为 8000 字符。

```typescript
// [gen-skill-docs.ts:~150] Host 配置表
const HOST_CONFIG = {
  'claude_desktop': {
    description: { limit: 8000, behavior: 'error' },
    name: { limit: 32, behavior: 'warn' },
  },
  'claude_code': {
    description: { limit: 4000, behavior: 'warn' },
    name: { limit: 50, behavior: 'warn' },
  },
  'cursor': {
    description: { limit: 5000, behavior: 'warn' },
    name: { limit: 40, behavior: 'error' },
  },
  'vscode': {
    description: { limit: 6000, behavior: 'truncate' },
    name: { limit: 45, behavior: 'warn' },
  },
  'windsurf': {
    description: { limit: 7000, behavior: 'warn' },
    name: { limit: 50, behavior: 'warn' },
  },
  'openai': {
    description: { limit: 2000, behavior: 'error' },  // 最严格的限制
    name: { limit: 35, behavior: 'error' },
  },
  'generic': {
    description: { limit: 8000, behavior: 'warn' },
    name: { limit: 50, behavior: 'warn' },
  },
};
```

验证行为（`behavior` 字段）有三种策略：

| 行为 | 含义 | 使用场景 |
|------|------|----------|
| `error` | 超限则抛出错误，终止生成 | 硬性限制（如 OpenAI 的 2000 字符上限） |
| `warn` | 超限则输出警告，继续生成 | 软性限制，容忍轻微超限 |
| `truncate` | 超限则自动截断 | VS Code 等自动截断过长内容的 Host |

### 4.1.3 AI Slop 黑名单

你可能见过这样的前端设计描述：

> "The hero section features a stunning blue-to-purple gradient background with frosted glass navigation, glass morphism cards, and a 3-column feature grid with icon-in-colored-circle and bold titles."

这是典型的 **AI Slop**——AI 生成的高重复性、模板化设计描述。gstack 内置了一个 10 条反模式黑名单，在模板编译时检测这类描述：

```typescript
// [gen-skill-docs.ts:~80] AI Slop 黑名单
const AI_SLOP_BLACKLIST = [
  'Purple/violet/indigo gradient backgrounds or blue-to-purple color schemes',
  '**The 3-column feature grid:** icon-in-colored-circle + bold title + 2-line description, repeated 3x symmetrically.',
  'The "Powerful" adjective + "Seamless" adjective + "Intuitive" adjective pattern',
  'Glass morphism (frosted glass) effects',
  '"Crafted with precision" / "Meticulously designed" / "Engineered for excellence"',
  'Countdown timers / "Limited time only" urgency indicators',
  '"Join millions of developers" social proof claims',
  'Auto-playing carousel with testimonials',
  'Confetti or particle effects on successful actions',
  'Oversized drop shadow on cards (box-shadow: 0 20px 60px rgba(0,0,0,0.3))',
];
```

当模板内容命中黑名单时，编译输出会包含 `⚠️ FRONTEND DESIGN REVIEW` 警告。这个机制确保 gstack 的技能描述保持技术性和精确性，而非堆砌空洞的营销词汇。

### 4.1.4 Voice Trigger 的提取与折叠

Voice Trigger 是 gstack 的语音交互扩展。模板作者可以在 `.tmpl` 中用 YAML 格式声明语音触发词：

```yaml
---
voice:
  triggers:
    - "review this code"
    - "检查代码质量"
    - "run the linter"
---

# {{SKILL_NAME}}

{{DESCRIPTION}}
```

编译时，`extractVoiceTriggers()` 函数从 YAML 块中提取触发词列表，然后通过 `processVoiceTriggers()` 将其折叠到 `description` 字段中：

```typescript
// [gen-skill-docs.ts:~220] Voice Trigger 处理
function extractVoiceTriggers(content: string): string[] {
  const voiceMatch = content.match(/voice:\s*\n\s*triggers:\s*\n([\s\S]*?)(?=^---|\n\w)/m);
  if (!voiceMatch) return [];
  const triggerLines = voiceMatch[1].split('\n')
    .map(l => l.replace(/^\s+-\s*/, '').trim())
    .filter(Boolean);
  return triggerLines;
}

function processVoiceTriggers(description: string, triggers: string[]): string {
  if (triggers.length === 0) return description;
  const triggerSection = `Voice triggers: ${triggers.join(', ')}`;
  return `${description}\n\n${triggerSection}`;
}
```

### 4.1.5 OpenAI 格式生成

对于 OpenAI 兼容的 Agent，SKILL.md 需要包含一个特殊的 `openai` YAML 块，定义 Function Calling 的参数格式：

```typescript
// [gen-skill-docs.ts:~280] OpenAI YAML 生成
function generateOpenAIYaml(displayName: string, shortDescription: string): string {
  return `
openai:
  type: \`function\`
  name: \`${displayName}\`
  description: \`${shortDescription.slice(0, 120)}\`
  parameters:
    type: object
    properties: {}
    required: []
`.trim();
}
```

注意 `shortDescription.slice(0, 120)` —— OpenAI 对函数描述有 120 字符的硬性限制。这是 `condenseOpenAIShortDescription()` 函数的核心约束。

---

## 4.2 前导脚本注入机制

### 4.2.1 Preamble 的职责边界

如果说模板编译是**印刷厂的排版车间**，那么 **Preamble（前导脚本）** 就是**机场安检**——每个乘客（技能）在登机（执行）前都必须通过安检，确保携带的行李（环境）符合要求。

Preamble 是一段 Bash 脚本，由 `generatePreambleBash()` 函数生成，在每次技能执行前注入到 Agent 的上下文中。它的职责是：

```typescript
// [preamble.ts:~50] Preamble 生成函数
function generatePreambleBash(ctx: Context): string {
  // 1. Bash 运行时检测
  // 2. gstack-update-check（版本检查）
  // 3. 会话跟踪（基于 PPID）
  // 4. 用户偏好检测
  // 5. 主动建议生成
  // 6. 路由规则注入
  // 7. 遥测配置
  return bashScript;
}
```

Preamble 输出的不是技能本身的指令，而是一系列**环境检测命令**。这些命令的执行结果会被 gstack 捕获并注入到后续的 Agent 上下文中，让技能能够感知运行环境。

### 4.2.2 会话跟踪与 PPID

gstack 使用 **PPID（父进程 ID）** 作为会话标识符。每个会话在 `~/.gstack/sessions/` 下创建一个文件：

```bash
# 会话跟踪逻辑（Preamble 注入的 Bash 代码）
mkdir -p ~/.gstack/sessions
touch ~/.gstack/sessions/"$PPID"

# 统计 120 分钟内活跃的会话数
_SESSIONS=$(find ~/.gstack/sessions -mmin -120 -type f 2>/dev/null | wc -l | tr -d ' ')

# 清理超过 120 分钟的孤立会话文件
find ~/.gstack/sessions -mmin +120 -type f -exec rm {} + 2>/dev/null || true
```

这个设计的巧妙之处在于：

- **无状态**：不需要维护一个常驻进程来追踪会话
- **自清理**：超过 120 分钟不活跃的会话自动消失
- **PPID 隔离**：不同终端窗口、不同调用链路的会话互不干扰

### 4.2.3 路由规则动态注入

Preamble 还负责将技能特定的**路由规则**注入到 Host 的配置文件中（如 `~/.claude/commands/CLAUDE.md`）：

```typescript
// [preamble.ts:~180] 路由注入函数
function generateRoutingInjection(ctx: Context): string {
  // 读取 ~/.claude/commands/CLAUDE.md 或等效路由文件
  // 追加技能特定的路由规则
  // 例如: "当用户说 'review' 时，使用 /review 技能"
  return routingRules;
}
```

这意味着当你在 Claude Code 中说 "帮我 review 这个 PR" 时，Claude Code 会自动查找匹配的路由规则并调用 `/review` 技能。

### 4.2.4 遥测系统的分层设计

gstack 的遥测系统采用**三层架构**，用户可以按需选择参与级别：

```typescript
interface TelemetryConfig {
  mode: 'community' | 'anonymous' | 'off';
  localJsonl: boolean;
  remoteEndpoint?: string;
}
```

| 模式 | 本地日志 | 远程遥测 | 用途 |
|------|----------|----------|------|
| `community` | ✅ | ✅ | 参与社区数据分析 |
| `anonymous` | ✅ | ✅（匿名） | 仅发送匿名统计数据 |
| `off` | ✅ | ❌ | 仅本地记录，不外发 |

本地日志以 **JSONL**（JSON Lines）格式存储在 `~/.gstack/telemetry/` 目录下，便于用户事后分析或导入其他工具。

---

## 4.3 多专家分派模式

### 4.3.1 Review Army 交响乐团

当你说 "帮我 review 这个 PR" 时，gstack 并不是启动一个单一的 AI Agent 来做全面审查——它启动的是一整个**交响乐团**，每个乐器组（专家）同时演奏自己负责的声部，最终汇成交响乐。

这就是 **Review Army（审查军团）** 模式：

```
/review 调用
    │
    ├──→ Testing Specialist ──→ 测试覆盖率发现
    ├──→ Security Specialist ──→ 安全漏洞发现
    ├──→ Performance Specialist ──→ 性能问题发现
    ├──→ Data Migration Specialist ──→ 数据迁移风险
    ├──→ API Contract Specialist ──→ API 兼容性发现
    └──→ Design Specialist ──→ 架构设计建议
                                        │
                                        ↓
                              ┌─────────────────┐
                              │  Findings Merge  │
                              │  （发现合并）     │
                              └─────────────────┘
                                        │
                                        ↓
                              ┌─────────────────┐
                              │  最终审查报告     │
                              │  + PQS 评分      │
                              └─────────────────┘
```

### 4.3.2 Always-on vs Conditional 专家

Review Army 的专家分为两类：

**Always-on 专家**：无论什么代码，只要变更超过 50 行就必定分派。

| 专家 | 职责 |
|------|------|
| **Testing Specialist** | 检查测试覆盖率、测试质量、mock 使用是否合理 |
| **Maintainability Specialist** | 检查代码复杂度、命名规范、模块耦合度 |

**Conditional 专家**：根据代码的关键词特征，按需分派。

| 专家 | 触发关键词 | 职责 |
|------|-----------|------|
| **Security Specialist** | `auth`, `token`, `crypto`, `password` | 安全漏洞检测 |
| **Performance Specialist** | `query`, `loop`, `memory`, `cache` | 性能问题检测 |
| **Data Migration Specialist** | `migration`, `schema`, `db` | 数据迁移风险 |
| **API Contract Specialist** | `endpoint`, `api`, `route` | API 兼容性 |
| **Design Specialist** | 大文件/多模块变更 | 架构设计审查 |

```typescript
// [review-army.ts:~60] 专家选择函数
function generateSpecialistSelection(ctx: ScopeContext): Specialist[] {
  const scope = detectScope(ctx); // STACK / DIFF_LINES / TEST_FW

  const alwaysOn = selectAlwaysOn(ctx); // Testing + Maintainability
  const conditional = selectConditional(ctx, scope); // 按关键词匹配

  return [...alwaysOn, ...conditional];
}
```

### 4.3.3 自适应门控的数学原理

如果一个专家在 10 次分派中都没有发现任何问题，是否意味着它不再有用？gstack 的 **Adaptive Gating（自适应门控）** 机制给出了答案：是的，自动淘汰。

```typescript
// [review-army.ts:~140] 自适应门控
interface SpecialistStats {
  dispatched: number;      // 已分派次数
  findings: number;        // 发现数量
  critical: number;        // 严重问题数
  informational: number;   // 提示性发现数
}

function shouldGateSpecialist(stats: SpecialistStats): boolean {
  if (stats.dispatched >= 10 && stats.findings === 0) {
    return true; // 10+ 次分派，0 发现 → 自动门控
  }
  return false;
}
```

这个机制背后的思想是：

- **专业分工**：如果你的代码库从不涉及数据库，`Data Migration Specialist` 自然不会有发现
- **动态调整**：当代码库发生变化（如引入新框架）时，被门控的专家可能重新变得有价值
- **强制分派**：`--security`、`--performance`、`--testing`、`--all-specialists` 标志可以绕过门控

### 4.3.4 发现合并与 PQS 评分

多个专家并行运行后，会产生多份发现报告。`mergeFindings()` 函数负责：

1. **JSON 解析**：每个专家返回的发现可能格式不一，需要统一解析
2. **指纹去重**：两个专家可能发现同一个 bug，通过 `fingerprint` 字段去重
3. **置信度门控**：置信度低于 0.5 的发现被丢弃
4. **严重度排序**：critical → high → medium → low → informational
5. **PQS 计算**：综合评分，衡量 PR 的整体质量

```typescript
// [review-army.ts:~280] 发现合并
interface Finding {
  fingerprint: string;  // 唯一指纹，用于去重
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  confidence: number;    // 置信度 0.0 - 1.0
  specialist: string;    // 来源专家
  message: string;       // 发现描述
  location: string;     // 代码位置
}

function mergeFindings(allFindings: Finding[]): MergeResult {
  // 1. JSON 解析
  // 2. 指纹去重
  // 3. 置信度门控（< 0.5 丢弃）
  // 4. 严重度排序
  // 5. PR Quality Score（PQS）计算
  return result;
}
```

**PR Quality Score（PQS）** 是一个综合评分，范围 0-100，权重分配大致如下：

- 50% 来自发现数量与严重度
- 30% 来自测试覆盖率
- 20% 来自代码复杂度

### 4.3.5 红队分派

当审查发现以下任一条件时，Review Army 会额外分派 **Red Team（红队）** 进行更激进的攻击性审查：

- 超过 5 个高严重度（high+）问题
- 变更超过 200 行
- 存在 critical 级别的发现

红队会从**恶意用户视角**审视代码，寻找可被利用的漏洞或边界条件。

---

## 4.4 本章小结

本章我们深入了 gstack SKILL 系统的三层架构：

1. **模板编译层**：`.tmpl` → SKILL.md 的编译管线，包含 per-host 字段验证、AI Slop 检测、Voice Trigger 处理
2. **前导脚本层**：Preamble 在技能执行前注入环境检测代码，实现会话跟踪、路由注入、遥测配置
3. **专家分派层**：Review Army 以交响乐团模式并行分派多个专家，通过自适应门控智能调度，基于 PQS 评分输出最终审查报告

这三个层次的协作，使得 gstack 的 SKILL 系统既有**模板化的可维护性**（编译层）、又有**运行时的灵活性**（Preamble 层）、还有**并行化的效率**（Review Army 层）。

下一章我们将聚焦具体技能的实现：**/plan**、**/review**、**/ship** 这三个核心技能是如何利用本章介绍的底层机制工作的。

---

| 层级 | 核心文件 | 核心概念 |
|------|----------|----------|
| 模板编译 | `gen-skill-docs.ts` | 占位符、per-host 验证、AI Slop 黑名单 |
| 前导脚本 | `preamble.ts` | PPID 会话跟踪、路由注入、遥测分层 |
| 专家分派 | `review-army.ts` | Always-on/Conditional 专家、自适应门控、PQS |
