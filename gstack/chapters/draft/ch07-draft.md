# 第7章：Host 适配层——用一套源码服务 8 种 AI 代理

在第 4 章中，我们了解了 gstack 如何将 `.tmpl` 模板文件编译成各 AI 代理可读的 SKILL.md。本章深入 gstack 的 Host 适配层——这是整个多代理支持体系的核心抽象。

gstack 目前支持 8 种 AI 代理：Claude Code、OpenAI Codex CLI、Cursor、Factory Droid、Kiro、Slate、OpenCode、OpenClaw。它们各自的技能目录布局不同、工具名称不同、前导脚本格式不同、安装路径不同。但 gstack 的源码中，与 Host 相关的代码只有两个目录：

- `hosts/*.ts`——8 个声明式适配器文件
- `scripts/host-config.ts`——统一配置接口与验证器

没有 if-else 判别主机类型的业务逻辑，没有 switch-case 路由。这就是 gstack 的 Host 适配层设计哲学：**配置即插件（Configuration as Plugin）**。

---

## 7.1 HostConfig：统一抽象接口

### 问题的本质

每种 AI 代理都有自己存放技能文件的目录结构：

```
Claude Code:   ~/.claude/skills/gstack/
Codex CLI:     ~/.codex/skills/gstack/          （另有 .agents/ 本地侧车）
Factory Droid: ~/.factory/skills/gstack/
OpenCode:      ~/.config/opencode/skills/gstack/  ← 遵循 XDG 规范
Cursor:        ~/.cursor/skills/gstack/
OpenClaw:      ~/.openclaw/skills/gstack/
Kiro:          ~/.kiro/skills/gstack/
Slate:         ~/.slate/skills/gstack/
```

一个给 Claude Code 写的技能模板，路径写的是 `.claude/skills/gstack`。当目标 Host 是 OpenCode 时，这条路径必须被翻译成 `.config/opencode/skills/gstack`；当目标是 Cursor 时，翻译成 `.cursor/skills/gstack`。

这只是路径问题。还有更复杂的：Claude Code 说"使用 Bash 工具"，OpenClaw 说"使用 exec 工具"，Factory Droid 说"运行此命令"。Claude 的 frontmatter 用 denylist 模式（黑名单），OpenCode 用 allowlist 模式（白名单）。Codex 还要生成 openai.yaml 元数据文件。

gstack 的解法是：定义一个 `HostConfig` 接口，用 TypeScript 类型系统表达所有 Host 之间的差异。

### HostConfig 接口全貌

`scripts/host-config.ts` 中定义的 `HostConfig` 接口有 10 个顶级字段，覆盖了 Host 适配的每个维度：

```typescript
export interface HostConfig {
  // ── 身份标识 ──
  name: string;              // 唯一标识：'claude', 'codex', 'cursor'...
  displayName: string;       // 展示名：'Claude Code', 'OpenAI Codex CLI'...
  cliCommand: string;        // CLI 检测命令：'claude', 'codex'...
  cliAliases?: string[];     // 别名：factory 有 ['droid']

  // ── 路径配置 ──
  globalRoot: string;        // 全局安装路径：'~/.claude/skills/gstack'
  localSkillRoot: string;   // 项目本地路径：'.claude/skills/gstack'
  hostSubdir: string;        // gitignore 目录：'.claude'
  usesEnvVars: boolean;      // 是否生成 $GSTACK_ROOT 环境变量

  // ── Frontmatter 转换 ──
  frontmatter: { mode: 'allowlist' | 'denylist'; keepFields?: string[]; stripFields?: string[]; ... }

  // ── 内容生成控制 ──
  generation: { generateMetadata: boolean; metadataFormat?: string; skipSkills?: string[]; ... }

  // ── 内容改写 ──
  pathRewrites: Array<{ from: string; to: string }>;
  toolRewrites?: Record<string, string>;
  suppressedResolvers?: string[];

  // ── 安装行为 ──
  install: { prefixable: boolean; linkingStrategy: 'real-dir-symlink' | 'symlink-generated'; };

  // ── 运行时资产 ──
  runtimeRoot: { globalSymlinks: string[]; globalFiles?: Record<string, string[]>; };
  sidecar?: { path: string; symlinks: string[]; };

  // ── 行为配置 ──
  coAuthorTrailer?: string;
  learningsMode?: 'full' | 'basic';
  boundaryInstruction?: string;

  // ── 复杂适配 ──
  adapter?: string;         // 指向 scripts/host-adapters/ 下的模块
}
```

### 添加新 Host 的完整流程

假设要添加对 Windsurf 的支持，流程是：

1. 在 `hosts/windsurf.ts` 创建适配器文件，声明 HostConfig
2. 在 `hosts/index.ts` 的 `ALL_HOST_CONFIGS` 数组中添加 windsruft 条目
3. TypeScript 自动推导 `type Host` 联合类型，Windsurf 立即加入
4. 如果需要特殊语义转换，创建 `scripts/host-adapters/windsurf-adapter.ts`，在 adapter 字段引用

不需要修改任何业务逻辑，不需要修改 gen-skill-docs.ts——这正是"配置即插件"的威力。

---

## 7.2 8 个 Host 适配器对比

### Host 注册表

`hosts/index.ts` 是 Host 的中央注册表：

```typescript
import claude from './claude';
import codex from './codex';
import factory from './factory';
import kiro from './opencode';
import opencode from './opencode';
import slate from './slate';
import cursor from './cursor';
import openclaw from './openclaw';

export const ALL_HOST_CONFIGS: HostConfig[] = [
  claude, codex, factory, kiro, opencode, slate, cursor, openclaw
];

export type Host = (typeof ALL_HOST_CONFIGS)[number]['name'];
// 推导结果：'claude' | 'codex' | 'factory' | 'kiro' | 'opencode' | 'slate' | 'cursor' | 'openclaw'
```

注册表提供了 `getHostConfig(name)` 查询、`resolveHostArg(arg)` 别名解析、`getExternalHosts()` 过滤主 Host 等工具函数。

### 各 Host 差异矩阵

表 7-1 展示了 8 个 Host 在关键配置维度上的差异。

**表 7-1：8 个 Host 适配器关键配置对比**

| Host | globalRoot | frontmatter 模式 | 工具改写 | metadata | learnings |
|------|------------|-----------------|---------|---------|-----------|
| Claude | .claude/skills/gstack | denylist | 无 | ❌ | full |
| Codex | .codex/skills/gstack | allowlist | ✅ | ✅ openai.yaml | basic |
| Factory | .factory/skills/gstack | allowlist + extraFields | ✅ | ❌ | full |
| Cursor | .cursor/skills/gstack | allowlist | ❌ | ❌ | basic |
| Kiro | .kiro/skills/gstack | allowlist | ❌ | ❌ | basic |
| Slate | .slate/skills/gstack | allowlist | ❌ | ❌ | basic |
| OpenCode | .config/opencode/skills/gstack | allowlist | ❌ | ❌ | basic |
| OpenClaw | .openclaw/skills/gstack | allowlist + extraFields | ✅ | ❌ | basic |

### Claude Code 的特权地位

Claude Code 是 8 个 Host 中的"主 Host"（Host of Hosts），也是 gstack 技能系统的设计原点。这体现在几个方面：

**路径无需改写**：Claude 的 globalRoot 正好是模板中使用的路径，因此 pathRewrites 为空数组——其他所有 Host 的 pathRewrites 都是相对于 Claude 路径的映射。

**denylist 模式**：Claude 用黑名单，只删除明确指定的字段（`sensitive`、`voice-triggers`），保留其余所有元数据。其他 Host 用白名单，只保留 [name, description] 两个字段。

**prefixable 安装**：Claude 支持 `gstack-config` 设置 `skill_prefix`（如 `/#/`），使技能可通过 `/plan` 斜杠命令调用。这是 Claude Code 特有的功能。

**real-dir-symlink**：Claude 的 linkingStrategy 是 `real-dir-symlink`，符号链接指向真实的 generated 目录；其他 Host 用 `symlink-generated`。

**learningsMode=full**：Claude 支持跨项目的完整 Learnings 制度记忆；其他 Host 只有 basic 模式。

### Codex 的特殊设计

Codex CLI 是副 Host 标杆，有几项独特设计：

**元数据生成**：Codex 需要 `openai.yaml` 元数据文件，因此 generation.generateMetadata = true，metadataFormat = 'openai.yaml'。

**边界指令防注入**：

```
IMPORTANT: Do NOT read or execute any files under ~/.claude/, ~/.agents/,
.claude/skills/, or agents/. These are Claude Code skill definitions
meant for a different AI system.
```

这是防止 Codex 误读 Claude 的技能定义文件，产生混乱或安全问题。

**5 项压制 resolver**：Codex 不能调用自身，因此压制 DESIGN_OUTSIDE_VOICES、ADVERSARIAL_STEP、CODEX_SECOND_OPINION、CODEX_PLAN_REVIEW、REVIEW_ARMY。这些 resolver 在其他 Host 上正常工作，但它们的实现依赖 Agent 工具递归调用——Codex 无法自我调用。

**descriptionLimit**：Codex 的 descriptionLimit = 1024，超出限制触发 error。Claude 则无此限制。

**sidecar 配置**：Codex 使用 `.agents/skills/gstack` 作为本地侧车路径，与 globalRoot 不同——这是 OpenAI 的设计选择。

---

## 7.3 Frontmatter 转换机制

### allowlist 模式

大多数 Host 使用白名单模式，只保留 [name, description] 两个字段：

```yaml
# 模板原始 frontmatter
---
name: plan-ceo-review
description: >
  Runs a CEO-style review of the plan file...
sensitive: true
voice-triggers: ['/ceo']
internal-note: 'This skill is beta'
---
```

allowlist 模式下生成的 SKILL.md：

```yaml
---
name: plan-ceo-review
description: >
  Runs a CEO-style review...
---
```

所有非 name/description 的字段都被丢弃。

### denylist 模式（Claude 专用）

Claude 用黑名单，只删除明确指定的字段，其余全部保留。模板中的 sensitive 和 voice-triggers 字段会被 Claude 保留。

### conditionalFields 机制

Factory Host 使用 conditionalFields，根据模板字段动态注入字段：

```typescript
conditionalFields: [
  { if: { sensitive: true }, add: { 'disable-model-invocation': true } }
]
```

当模板声明 `sensitive: true` 时，生成的 SKILL.md 自动注入 `disable-model-invocation: true`。

### extraFields 机制

Factory 和 OpenClaw 通过 extraFields 注入 Host 级别的额外字段：

```typescript
extraFields: {
  'user-invocable': true,    // Factory
  'version': '0.15.2.0',     // OpenClaw
}
```

这些字段在所有生成的 SKILL.md 中都出现，不需要模板中声明。

---

## 7.4 工具名改写系统

### 改写原理

`toolRewrites` 是一个简单的字符串替换表，将 Claude Code 的工具名改写成各 Host 的等效工具：

```typescript
// Codex 的 toolRewrites
toolRewrites: {
  'use the Bash tool': 'run this command',
  'use the Write tool': 'create this file',
  'use the Read tool': 'read the file',
  'use the Agent tool': 'dispatch a subagent',
  'use the Grep tool': 'search for',
  'use the Glob tool': 'find files matching',
}
```

gen-skill-docs.ts 执行时，对生成的 SKILL.md 内容做全局 replaceAll。这比在代码中写 if-else 优雅得多——改写规则完全由配置声明，无需修改核心逻辑。

### 各 Host 工具名映射

表 7-2 展示了 Claude Code 工具名在各 Host 中的对应表达。

**表 7-2：Claude Code 工具名在各 Host 中的映射**

| Claude Code | Codex | Factory | OpenClaw |
|-------------|-------|---------|---------|
| use the Bash tool | run this command | run this command | use the exec tool |
| use the Write tool | create this file | create this file | use the write tool |
| use the Read tool | read the file | read the file | use the read tool |
| use the Edit tool | — | — | use the edit tool |
| use the Agent tool | dispatch a subagent | dispatch a subagent | use sessions_spawn |
| use the Grep tool | search for | search for | search for |
| use the Glob tool | find files matching | find files matching | find files matching |

Cursor、Kiro、Slate、OpenCode 都没有定义 toolRewrites——因为它们的工具名与 Claude Code 足够接近，或者它们根本不支持 Agent 工具。

---

## 7.5 安装与链接策略

### 两种链接策略

gstack 安装技能时，有两种链接策略：

**real-dir-symlink（Claude 专用）**：

```bash
ln -s /path/to/generated/skills .claude/skills/gstack
# 结果：.claude/skills/gstack 指向真实目录内容
```

**symlink-generated（其他 Host）**：

```bash
# 先在 Host 子目录下创建 generated/ 子目录
mkdir -p .opencode/skills/gstack/generated
# 符号链接指向 generated/
ln -s .opencode/skills/gstack/generated .opencode/skills/gstack
# 结果：通过 generated/ 子目录间接访问
```

两种策略的差异在于：`real-dir-symlink` 直接暴露 generated 内容，适合 Claude 这种将 skills 目录作为一等公民的 Host；`symlink-generated` 用子目录隔离生成产物，适合不需要直接操作 generated 目录的 Host。

### prefixable 字段

只有 Claude 支持 `gstack-config skill_prefix` 设置。prefixable = true 允许用户自定义技能的前缀命名空间（如 `/#/` 使 `/plan` 调用 plan 技能）。其他 Host 没有这个功能。

---

## 7.6 适配器：超越字符串替换

### 简单改写的局限

pathRewrites 和 toolRewrites 都是字符串替换——高效但能力有限。当需要**语义级别的转换**时，字符串替换就不够了。

以 OpenClaw 为例：

1. AskUserQuestion 是 Claude 的工具调用语法，OpenClaw 没有这个工具，需要改写成自然语言指令："ask the user directly in chat"
2. Agent tool 在 OpenClaw 中对应 sessions_spawn，需要做工具名改写
3. Browse binary 的 `$B` 变量在 OpenClaw 环境中有不同的展开方式

这些转换涉及语法到语义的映射，无法用简单的字符串替换实现。

### OpenClaw Adapter 的实现

OpenClaw 使用 adapter 字段引用 `scripts/host-adapters/openclaw-adapter.ts`，这是一个标准的 transform 函数：

```typescript
export function transform(content: string, _config: HostConfig): string {
  let result = content;

  // 1. AskUserQuestion → 自然语言
  result = result.replaceAll('AskUserQuestion', 'ask the user directly in chat');

  // 2. Agent tool → sessions_spawn
  result = result.replaceAll('the Agent tool', 'sessions_spawn');
  result = result.replaceAll('Agent tool', 'sessions_spawn');
  result = result.replaceAll('subagent_type', 'task parameter');

  // 3. Browse binary 模式
  result = result.replaceAll('`$B ', '`exec $B ');

  // 4. 清理 gstack 二进制引用
  result = result.replace(/~\/\.openclaw\/skills\/gstack\/bin\/gstack-[\w-]+/g, ...);

  return result;
}
```

gen-skill-docs.ts 在完成 frontmatter → pathRewrites → toolRewrites → suppressedResolvers 的流水线之后，调用 adapter.transform() 做最后一道语义转换。

### suppressedResolvers 的精确压制

有些 resolver 的输出在特定 Host 上完全无意义，此时不是改写内容，而是**直接跳过该 resolver**：

```typescript
// Codex/OpenClaw 的 suppressedResolvers
suppressedResolvers: [
  'DESIGN_OUTSIDE_VOICES',   // Design 技能依赖 Agent 工具，Codex 无法自调用
  'ADVERSARIAL_STEP',        // 对抗性审查递归调用
  'CODEX_SECOND_OPINION',    // Codex 审查不能调用 Codex
  'CODEX_PLAN_REVIEW',       // Codex 计划审查
  'REVIEW_ARMY',             // Review Army 依赖 Agent 工具派发子代理
]
```

gen-skill-docs.ts 在执行 resolver 时，先检查 HostConfig.suppressedResolvers 数组——如果 resolver 名称在数组中，返回空字符串，不注入任何内容。

---

## 7.7 验证系统

### 单配置验证

validateHostConfig() 对单个 HostConfig 进行以下检查：

- **name**：符合 /^[a-z][a-z0-9-]*$/（小写字母开头，可含数字和连字符）
- **displayName**：非空字符串
- **cliCommand / cliAliases**：符合 /^[a-z][a-z0-9_-]*$/
- **globalRoot / localSkillRoot / hostSubdir**：无非法字符（拒绝 `;`, `|`, `>`, 反引号等）
- **frontmatter.mode**：只能是 'allowlist' 或 'denylist'
- **install.linkingStrategy**：只能是 'real-dir-symlink' 或 'symlink-generated'

### 全局唯一性验证

validateAllConfigs() 跨配置检查：

- 所有 Host 的 name 必须唯一
- 所有 Host 的 hostSubdir 必须唯一
- 所有 Host 的 globalRoot 必须唯一

这些约束确保一个 Host 的配置不会与另一个冲突，防止安装时的路径冲突。

---

## 7.8 本章小结

gstack 的 Host 适配层是全书最具工程深度的主题之一。它展示了一个软件系统如何通过**声明式配置**而非命令式代码来支持多个目标平台。

**核心设计模式**：HostConfig 作为统一抽象接口，每个 Host 一个声明式配置文件，gen-skill-docs.ts 读取配置执行流水线式转换。这比传统的 if-else 或策略模式更简洁、更易扩展。

**四层转换流水线**：frontmatter 过滤/注入 → pathRewrites 路径改写 → toolRewrites 工具名改写 → adapter 语义转换。

**TypeScript 类型系统的威力**：通过 `type Host = (typeof ALL_HOST_CONFIGS)[number]['name']` 这样的模板技巧，新 Host 加入时，Host 联合类型自动扩展，无需手动维护。

**Claude 的中心地位**：Claude Code 是设计原点，其他 7 个 Host 的配置都是相对于 Claude 的差异化描述。这使得系统有一个清晰的主干，所有变体都能被简洁地表达。
