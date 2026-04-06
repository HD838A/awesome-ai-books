# ch07 研究报告：Host 适配层

## 概览

**主题**：gstack 的 Host 适配层——如何用一套源码支持 8 种 AI 代理

**核心问题**：gstack 的技能系统（SKILL.md 模板）如何翻译成各 AI 代理的本地格式？Claude Code、OpenAI Codex、Cursor、Factory Droid、Kiro、Slate、OpenCode、OpenClaw——它们的目录结构、工具名称、前导脚本格式各不相同，但 gstack 用同一套模板服务所有这些 Host。

**数据来源**：
- `scripts/host-config.ts`：HostConfig 接口定义（190 行，完整类型系统）
- `hosts/index.ts`：Host 注册表（ALL_HOST_CONFIGS, getHostConfig, resolveHostArg）
- `hosts/claude.ts`, `codex.ts`, `factory.ts`, `cursor.ts`, `kiro.ts`, `slate.ts`, `opencode.ts`, `openclaw.ts`：8 个独立适配器
- `scripts/host-adapters/openclaw-adapter.ts`：自定义适配器示例

---

## 7.1 统一抽象：HostConfig 接口

### 核心设计思想

gstack 不为每个 Host 写独立代码，而是定义一个 **typed declarative config** 对象，每个 Host 一个。HostConfig 覆盖以下维度：

| 维度 | 字段 | 作用 |
|------|------|------|
| 身份标识 | name, displayName, cliCommand, cliAliases | Host 发现与 CLI 检测 |
| 路径配置 | globalRoot, localSkillRoot, hostSubdir, usesEnvVars | 目录结构映射 |
| Frontmatter | frontmatter.{mode, keepFields, stripFields, ...} | 元数据字段过滤/注入 |
| 内容生成 | generation.{generateMetadata, skipSkills, includeSkills} | 生成控制 |
| 内容改写 | pathRewrites, toolRewrites, suppressedResolvers | 字符串替换 |
| 安装行为 | install.{prefixable, linkingStrategy} | 软链接策略 |
| 运行时资产 | runtimeRoot.{globalSymlinks, globalFiles}, sidecar | 符号链接与文件复制 |
| 行为配置 | coAuthorTrailer, learningsMode, boundaryInstruction | Host 特定行为 |
| 适配器 | adapter（可选路径） | 复杂语义转换 |

### HostConfig 验证系统

`host-config.ts` 内置 validateHostConfig() 和 validateAllConfigs()，检查：
- name 符合 /^[a-z][a-z0-9-]*$/（如 claude, opencode）
- displayName 非空
- cliCommand/Aliases 符合命名规范
- globalRoot/localSkillRoot/hostSubdir 无非法字符
- frontmatter.mode 只能是 'allowlist' 或 'denylist'
- linkingStrategy 只能是两种之一
- 跨 Host 唯一性：name、hostSubdir、globalRoot 均不可重复

### 路径映射原理

每套 AI 代理的技能目录布局不同：

```
Claude Code:  ~/.claude/skills/gstack        ← 主 Host，无改写
Codex CLI:    ~/.codex/skills/gstack         ← 另有 .agents/ 本地侧车
Factory:      ~/.factory/skills/gstack
OpenCode:     ~/.config/opencode/skills/gstack  ← 使用 XDG 规范
Cursor:       ~/.cursor/skills/gstack
OpenClaw:     ~/.openclaw/skills/gstack
Kiro:         ~/.kiro/skills/gstack
Slate:        ~/.slate/skills/gstack
```

通过 `pathRewrites` 数组，将模板中的 `.claude/skills/gstack` 路径改写成对应 Host 的实际路径。

---

## 7.2 8 个 Host 适配器对比

### 全局共性

所有 Host 的 runtimeRoot 共享：
```ts
runtimeRoot: {
  globalSymlinks: ['bin', 'browse/dist', 'browse/bin', 'gstack-upgrade', 'ETHOS.md'],
  globalFiles: { 'review': ['checklist.md', 'TODOS-format.md'] }
}
```

这确保 bin/、浏览工具、升级脚本、伦理文档在所有 Host 上均可访问。

### 各 Host 差异矩阵

| Host | globalRoot | frontmatter | metadata | suppressed | learns |
|------|------------|-------------|----------|-----------|--------|
| **claude** | .claude/skills/gstack | denylist: strip [sensitive, voice-triggers] | ❌ | 无 | full |
| **codex** | .codex/skills/gstack | allowlist: keep [name, description] | ✅ openai.yaml | 5 个 resolver | basic |
| **factory** | .factory/skills/gstack | allowlist + extraFields | ❌ | 无 | full |
| **cursor** | .cursor/skills/gstack | allowlist: keep [name, description] | ❌ | 无 | basic |
| **kiro** | .kiro/skills/gstack | allowlist: keep [name, description] | ❌ | 无 | basic |
| **slate** | .slate/skills/gstack | allowlist: keep [name, description] | ❌ | 无 | basic |
| **opencode** | .config/opencode/skills/gstack | allowlist: keep [name, description] | ❌ | 无 | basic |
| **openclaw** | .openclaw/skills/gstack | allowlist + extraFields + adapter | ❌ | 5 个 resolver | basic |

### Claude Code 特殊地位

Claude 是**主 Host**（Host of Hosts）：
- 无 pathRewrites——模板路径即真实路径
- frontmatter.mode = 'denylist'，只删除敏感字段，其余全部保留
- install.prefixable = true（支持 gstack-config skill_prefix 自定义前缀）
- learningsMode = 'full'（跨项目学习）
- 无 suppressedResolvers
- linkingStrategy = 'real-dir-symlink'（而非 symlink-generated）

### Codex 特殊设计

Codex 是**副 Host 标杆**，有多个 Host 特有设计：
- 生成 openai.yaml 元数据（metadataFormat: 'openai.yaml'）
- suppressedResolvers 有 5 项（DESIGN_OUTSIDE_VOICES, ADVERSARIAL_STEP, CODEX_SECOND_OPINION, CODEX_PLAN_REVIEW, REVIEW_ARMY）—— 因为 Codex 不能调用自身
- boundaryInstruction：反注入边界指令，防止误读 Claude 技能文件
- sidecar 配置：.agents/skills/gstack 作为本地侧车
- CLI 别名：`agents`（`codex agents` 命令）
- descriptionLimit = 1024，超出触发 error

### OpenClaw 适配器

OpenClaw 使用自定义 adapter 路径：`./scripts/host-adapters/openclaw-adapter`，处理 4 类语义转换：
1. **AskUserQuestion** → "ask the user directly in chat"
2. **Agent tool** → sessions_spawn（工具名改写）
3. **Browse binary** → exec $B（前缀处理）
4. **gstack 二进制引用** → strip 或 map

---

## 7.3 Frontmatter 模式

### allowlist 模式（大多数 Host）

```yaml
# Codex/Cursor/Kiro/Slate/OpenCode 示例
---
name: plan-ceo-review
description: >
  Runs a CEO-style review of the plan file, checking for completeness,
  feasibility, and alignment with project goals.
---
```

Codex 还有 descriptionLimit: 1024 强制截断。

### denylist 模式（Claude 主 Host）

```yaml
# Claude 原始模板有 sensitive / voice-triggers 字段
---
name: plan-ceo-review
description: >
  Runs a CEO-style review...
sensitive: true        ← Claude 保留（denylist 只删除明确指定的字段）
voice-triggers: [...]  ← Claude 保留
---
# 生成后端：stripFields = ['sensitive', 'voice-triggers']
---
name: plan-ceo-review
description: >
  Runs a CEO-style review...
---
```

### conditionalFields 模式（Factory）

```ts
conditionalFields: [
  { if: { sensitive: true }, add: { 'disable-model-invocation': true } }
]
```

当模板声明 sensitive: true 时，自动注入 disable-model-invocation: true。

---

## 7.4 工具名改写系统

`toolRewrites` 将 Claude Code 工具名映射到各 Host 的等效工具：

| Claude Code | Codex | Factory | OpenClaw |
|-------------|-------|---------|---------|
| use the Bash tool | run this command | run this command | use the exec tool |
| use the Write tool | create this file | create this file | use the write tool |
| use the Read tool | read the file | read the file | use the read tool |
| use the Edit tool | — | — | use the edit tool |
| use the Agent tool | dispatch a subagent | dispatch a subagent | use sessions_spawn |
| use the Grep tool | search for | search for | search for |
| use the Glob tool | find files matching | find files matching | find files matching |

---

## 7.5 安装与链接策略

### real-dir-symlink（Claude）

```bash
# Claude 的 .claude/skills/gstack 指向真实目录
.ln -s /path/to/generated .claude/skills/gstack
```

### symlink-generated（其他 Host）

```bash
# 其他 Host 指向 generated/ 子目录
ln -s .opencode/skills/gstack/generated .opencode/skills/gstack
```

### prefixable 字段

Claude 支持 gstack-config 设置 skill_prefix（如 `/#/` 前缀使技能通过 `/plan` 调用），其他 Host 不支持此功能。

---

## 7.6 Host 注册与发现机制

hosts/index.ts 提供完整工具函数：

```ts
export const ALL_HOST_CONFIGS: HostConfig[] = [...]   // 全部 Host
export const HOST_CONFIG_MAP: Record<string, HostConfig>  // name → config 映射
export type Host = (typeof ALL_HOST_CONFIGS)[number]['name']  // 联合类型
export const ALL_HOST_NAMES: string[]  // CLI 验证用

export function getHostConfig(name: string): HostConfig  // 按名获取，not found 抛错
export function resolveHostArg(arg: string): string      // 处理别名：agents → codex
export function getExternalHosts(): HostConfig[]         // 过滤掉 Claude（主 Host）
```

### 别名系统

Factory Host 有 cliAliases: ['droid']，resolveHostArg 遍历所有 Host 的别名表，返回匹配的主名称。

---

## 7.7 suppressedResolvers 机制

当某个 resolver 的输出在特定 Host 上无意义时，在 HostConfig 中声明 suppressedResolvers，gen-skill-docs.ts 跳过该 resolver，返回空字符串。

典型场景：Codex/OpenClaw 不能调用自身，因此压制：
- DESIGN_OUTSIDE_VOICES（Design 技能使用 Agent 工具递归调用）
- ADVERSARIAL_STEP（对抗性审查递归调用）
- CODEX_SECOND_OPINION（Codex 审查不能调用 Codex）
- CODEX_PLAN_REVIEW（Codex 计划审查）
- REVIEW_ARMY（Review Army 使用 Agent 工具派发子代理）

---

## 关键发现

1. **配置即插件**：每个新 Host 只需创建一个 `hosts/newhost.ts` 文件，声明 HostConfig，然后添加到 `hosts/index.ts` 的 ALL_HOST_CONFIGS 数组。无需修改核心逻辑。

2. **三层改写顺序**：gen-skill-docs.ts 按顺序执行：① frontmatter 过滤/注入 → ② pathRewrites → ③ toolRewrites → ④ suppressedResolvers → ⑤ adapter 语义转换。

3. **Host 联合类型自动推导**：`type Host = (typeof ALL_HOST_CONFIGS)[number]['name']` 使 TypeScript 自动从配置列表推导联合类型，新 Host 加入时类型自动扩展。

4. **OpenClaw 的双重适配**：既有 toolRewrites（工具名改写），又有 adapter（语义转换）——说明简单的字符串替换不够用时，需要编程式适配器。

5. **Claude 的特权地位**：8 个 Host 中只有 Claude 是 denylist 模式、real-dir-symlink、prefixable=true、learningsMode=full——它既是技能系统的设计原点，也是其他 Host 的适配目标。
