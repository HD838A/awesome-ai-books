# ch04 研究报告：SKILL.md 模板系统与 SKILL 运行时

> **批次**: Phase 3 第 2 批（ch04-ch06）
> **研究员**: Scriptorium Phase 3.7
> **研究日期**: 2026-04-06
> **状态**: ✅ 完成

---

## 1. 研究目标

本章聚焦 gstack 的 **SKILL 系统三层架构**：

1. **模板层**（gen-skill-docs.ts）：`.tmpl` → SKILL.md 的编译管线
2. **运行时层**（preamble.ts）：每次技能执行前注入 Bash 前导脚本
3. **分发层**（review-army.ts）：技能的分派与多专家合并机制

研究问题：

- SKILL.md 的元数据字段如何通过模板引擎生成？
- Preamble 的运行时注入机制如何工作？
- Review Army 如何实现多专家并行审查？

---

## 2. 核心源文件

| 文件路径 | 行数 | 职责 |
|----------|------|------|
| `scripts/gen-skill-docs.ts` | ~500+ | 模板编译、字段验证、AI slop 检测 |
| `scripts/resolvers/preamble.ts` | ~400+ | Bash 前导脚本生成 |
| `scripts/resolvers/review-army.ts` | ~400+ | 多专家分派与发现合并 |

---

## 3. 模板编译管线（gen-skill-docs.ts）

### 3.1 编译流程概览

```
.tmpl 文件读取
    ↓
{{PLACEHOLDER}} 扫描
    ↓
从源码动态解析占位符值
    ↓
字段长度验证（per-host 限制）
    ↓
Voice Trigger 处理
    ↓
前端设计审查（AI Slop 检测）
    ↓
SKILL.md 写入
```

### 3.2 核心数据结构

**占位符类型**（从源码解析）：

```typescript
// 从 gen-skill-docs.ts 源码中提取的占位符模式
const PLACEHOLDER_TYPES = {
  '{{DESCRIPTION}}':       '技能描述文本',
  '{{SHORT_DESCRIPTION}}': '短描述（用于卡片展示）',
  '{{EXAMPLES}}':          '使用示例',
  '{{TAGS}}':              '技能标签数组',
  '{{HOSTS}}':             '支持的 Host 列表',
  '{{PERMISSIONS}}':       '所需权限列表',
  '{{VOICE_TRIGGERS}}':    '语音触发词',
};
```

**Host 配置表**（per-host 字段限制）：

```typescript
// 从源码提取的 Host 配置
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
    description: { limit: 2000, behavior: 'error' },
    name: { limit: 35, behavior: 'error' },
  },
  'generic': {
    description: { limit: 8000, behavior: 'warn' },
    name: { limit: 50, behavior: 'warn' },
  },
};
```

**验证行为**（`behavior` 字段）：

- `error`: 超出限制时抛出错误，终止生成
- `warn`: 超出限制时输出警告，继续生成
- `truncate`: 超出限制时自动截断

### 3.3 AI Slop 黑名单

gstack 内置了一个 **10 条反模式黑名单**，用于检测模板内容中是否包含"AI 味"十足的设计描述：

```typescript
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

这个黑名单在模板生成时被扫描，一旦命中会输出 `FRONTEND DESIGN REVIEW` 警告。

### 3.4 Voice Trigger 处理

```typescript
// 从 .tmpl 中提取 voice 触发词的 YAML 块
// 格式示例:
// ---
// voice:
//   triggers:
//     - "review this code"
//     - "检查代码质量"
// ---

function extractVoiceTriggers(content: string): string[] {
  const voiceMatch = content.match(/voice:\s*\n\s*triggers:\s*\n([\s\S]*?)(?=^---|\n\w)/m);
  if (!voiceMatch) return [];
  const triggerLines = voiceMatch[1].split('\n')
    .map(l => l.replace(/^\s+-\s*/, '').trim())
    .filter(Boolean);
  return triggerLines;
}

// 将触发词折叠进 description
function processVoiceTriggers(description: string, triggers: string[]): string {
  if (triggers.length === 0) return description;
  const triggerSection = `Voice triggers: ${triggers.join(', ')}`;
  return `${description}\n\n${triggerSection}`;
}
```

### 3.5 OpenAI YAML 生成

```typescript
// 为 OpenAI 的工具格式生成 YAML
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

---

## 4. 前导脚本注入（preamble.ts）

### 4.1 注入架构

Preamble 是 Bash 代码块，在每次 SKILL 执行时由 gstack 注入到 Agent 的上下文中。其核心职责是**环境感知**——让技能能够根据用户的实际环境动态调整行为。

```
技能调用
    ↓
generatePreambleBash(ctx)
    ↓
┌─────────────────────────────────────┐
│ 1. Bash 运行时检测                   │
│ 2. gstack-update-check              │
│ 3. 会话跟踪（PPID）                  │
│ 4. 用户偏好检测                      │
│ 5. 主动建议生成                      │
│ 6. 路由规则注入                      │
│ 7. 遥测配置                          │
└─────────────────────────────────────┘
    ↓
输出 Bash 脚本片段 → 注入 Agent 上下文
```

### 4.2 Preamble 生成的子模块

#### 4.2.1 Bash 运行时检测

```typescript
// 检测当前 shell 环境
function detectBashRuntime(): string {
  // 检查 SHELL 环境变量
  // 检测 zsh/bash/fish 等
  return runtime;
}
```

#### 4.2.2 会话跟踪

```typescript
// 基于 PPID 的会话跟踪
// 每个会话在 ~/.gstack/sessions/ 下创建文件
mkdir -p ~/.gstack/sessions
touch ~/.gstack/sessions/"$PPID"
_SESSIONS=$(find ~/.gstack/sessions -mmin -120 -type f 2>/dev/null | wc -l | tr -d ' ')
find ~/.gstack/sessions -mmin +120 -type f -exec rm {} + 2>/dev/null || true
```

- 以 `PPID`（父进程 ID）为会话标识
- 120 分钟内活跃的会话计入 `_SESSIONS` 计数器
- 超过 120 分钟的会话自动清理

#### 4.2.3 升级检查

```typescript
function generateUpgradeCheck(ctx): string {
  // 检测 gstack 版本是否过期
  // 检查 SKILL_PREFIX 命名空间
  // 输出升级提示或静默跳过
  return bashScript;
}
```

#### 4.2.4 路由规则注入

```typescript
function generateRoutingInjection(ctx): string {
  // 读取 ~/.claude/commands/CLAUDE.md 或等效路由文件
  // 追加技能特定的路由规则
  // 例如: "当用户说 'review' 时，使用 /review 技能"
  return routingRules;
}
```

#### 4.2.5 遥测系统

```typescript
interface TelemetryConfig {
  mode: 'community' | 'anonymous' | 'off';
  localJsonl: boolean;
  remoteEndpoint?: string;
}

function generateTelemetryPrompt(ctx: Context): string {
  // 本地 JSONL 日志记录
  // 可选的远程遥测端点
  // 用户可通过 gstack-telemetry-log 配置
  return telemetryPrompt;
}
```

### 4.3 Preamble 的"煮湖"原则

Preamble 输出中包含一个 **`generateLakeIntro()`** 函数，其核心原则是 **"Boil the Lake"（煮湖）**——即尽可能完整地呈现数据可见性，让 Agent 在执行技能前对环境有充分了解。

---

## 5. 多专家分派与发现合并（review-army.ts）

### 5.1 Review Army 模式概述

Review Army 是 gstack 的**并行多专家审查**模式。当用户调用 `/review` 时，系统同时分派多个 Specialist（专家）子代理，每个子代理从不同视角审查代码，最终合并所有发现。

```
/review 调用
    ↓
范围检测（STACK / DIFF_LINES / TEST_FW）
    ↓
专家选择（Always-on + Conditional）
    ↓
并行分派（Agent Tool dispatch）
    ↓
发现合并（Dedup + Confidence + PQS）
    ↓
最终报告输出
```

### 5.2 专家分类

#### Always-on 专家（始终分派）

| 专家 | 职责 | 触发条件 |
|------|------|----------|
| **Testing Specialist** | 测试覆盖率、测试质量 | 变更超过 50 行 |
| **Maintainability Specialist** | 代码可维护性 | 变更超过 50 行 |

#### Conditional 专家（按需分派）

| 专家 | 职责 | 触发条件 |
|------|------|----------|
| **Security Specialist** | 安全漏洞检测 | 文件包含 auth、token、crypto 等关键词 |
| **Performance Specialist** | 性能问题检测 | 文件包含 query、loop、memory 等关键词 |
| **Data Migration Specialist** | 数据迁移风险 | 涉及数据库变更 |
| **API Contract Specialist** | API 兼容性 | 涉及 API 端点变更 |
| **Design Specialist** | 架构设计审查 | 文件较大或涉及多模块 |

### 5.3 自适应门控（Adaptive Gating）

这是 Review Army 的**智能化调度**机制：

```typescript
interface SpecialistStats {
  dispatched: number;      // 已分派次数
  findings: number;        // 发现数量
  critical: number;        // 严重问题数
  informational: number;   // 提示性发现数
}

// 自适应门控逻辑
function shouldGateSpecialist(stats: SpecialistStats): boolean {
  if (stats.dispatched >= 10 && stats.findings === 0) {
    return true; // 10+ 次分派但 0 发现，自动门控
  }
  return false;
}

// 强制分派标志（绕过门控）
// --security, --performance, --testing, --all-specialists
```

- `gstack-specialist-stats` 追踪每个专家的命中率
- 10 次以上分派、0 发现的专家被自动门控（GATE_CANDIDATE）
- 标记为 `[NEVER_GATE]` 的专家永不门控
- 用户可通过 `--force` 标志强制分派被门控的专家

### 5.4 发现合并流程

```typescript
interface Finding {
  fingerprint: string;  // 去重指纹
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  confidence: number;   // 0.0 - 1.0
  specialist: string;  // 来源专家
  message: string;     // 发现描述
  location: string;     // 代码位置
}

function mergeFindings(allFindings: Finding[]): MergeResult {
  // 1. JSON 解析（处理子代理输出）
  // 2. 指纹去重（fingerprint 相同则合并）
  // 3. 置信度门控（< 0.5 丢弃）
  // 4. 严重度排序
  // 5. PR Quality Score（PQS）计算
  return result;
}
```

**PR Quality Score (PQS)**：综合评分，衡量 PR 的整体质量。

### 5.5 红队分派（Red Team）

条件性触发，当发现：

- 超过 5 个高严重度问题
- 变更超过 200 行
- 存在 `critical` 级别发现

则额外分派红队（Red Team）进行更激进的攻击性审查。

---

## 6. 章节核心比喻与写作风格

### 6.1 核心比喻

| 概念 | 比喻 | 说明 |
|------|------|------|
| gen-skill-docs.ts | 印刷厂 | 从模板（活字）到成品（SKILL.md）的批量印刷 |
| preamble.ts | 机场安检 | 登机前的环境检查和证件核验 |
| review-army.ts | 交响乐团 | 多乐器（专家）同时演奏，最终汇成和谐乐章 |
| Adaptive Gating | 选秀节目海选 | 自动淘汰长期无表现的选手 |
| Voice Trigger | 声纹解锁 | 用声音特征触发特定行为 |

### 6.2 叙述风格

- 采用**技术侦探**叙事：先抛出问题（如"SKILL.md 是如何生成的？"），再逐步揭示答案
- 代码引用时标注**源文件 + 行号**：`[gen-skill-docs.ts:42]`
- 复杂流程配**ASCII 流程图**
- 关键概念配**对比表格**

---

## 7. 章节大纲（草稿）

```
第4章：SKILL.md 模板系统——Markdown 即配置

4.1 模板编译管线
    4.1.1 从 .tmpl 到 SKILL.md
    4.1.2 per-host 字段验证
    4.1.3 AI Slop 黑名单检测
    4.1.4 Voice Trigger 的提取与折叠

4.2 前导脚本注入机制
    4.2.1 Preamble 的职责边界
    4.2.2 会话跟踪与 PPID
    4.2.3 路由规则动态注入
    4.2.4 遥测系统的分层设计

4.3 多专家分派模式
    4.3.1 Always-on vs Conditional 专家
    4.3.2 自适应门控的数学原理
    4.3.3 发现合并与 PQS 评分

4.4 章节小结
```

---

## 8. 待深入问题

以下问题需要进一步读源码确认：

1. **Voice Trigger 的实际使用场景**：触发后的行为路由在哪里实现？
2. **Preamble 注入的触发时机**：是 gstack 主程序注入还是 Agent Host 注入？
3. **Review Army 的 Agent Tool 具体调用参数**
4. **PQS 算法的具体计算公式**

这些问题建议在 ch05（核心技能解析）和 ch06（autoplan 与 review-army 深度）中进一步展开。

---

## 9. 相关章节关联

| 章节 | 关联点 |
|------|--------|
| ch01 | SKILL 的基本概念（`/skill-name` 调用方式） |
| ch05 | 核心技能解析：`/review` 是 review-army 的入口 |
| ch06 | autoplan 与 review-army 深度解析 |
| ch07 | Host 适配层：preamble 如何为不同 Host 生成兼容代码 |
| ch08 | 8 大 Agent：每种 Agent 对 preamble 可能有不同要求 |

---

## 10. 附录：关键代码片段索引

| 片段 | 文件:行号 |
|------|----------|
| AI_SLOP_BLACKLIST 定义 | `gen-skill-docs.ts:~80` |
| HOST_CONFIG 定义 | `gen-skill-docs.ts:~150` |
| extractVoiceTriggers 函数 | `gen-skill-docs.ts:~220` |
| generateOpenAIYaml 函数 | `gen-skill-docs.ts:~280` |
| generatePreambleBash 函数 | `preamble.ts:~50` |
| 会话跟踪逻辑 | `preamble.ts:~100` |
| generateRoutingInjection 函数 | `preamble.ts:~180` |
| SpecialistSelection 函数 | `review-army.ts:~60` |
| Adaptive Gating 逻辑 | `review-army.ts:~140` |
| mergeFindings 函数 | `review-army.ts:~280` |
