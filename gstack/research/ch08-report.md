# ch08 研究报告：8 大 AI 代理支持

## 概览

**主题**：gstack 如何在运行时与 8 种 AI 代理深度集成，以及如何添加新 Host

**与 ch07 的关系**：ch07 讲"配置层"——HostConfig 接口声明；ch08 讲"运行时层"——这些配置如何在 gstack 的各个环节被消费。ch08 是 ch07 的下游。

**数据来源**：
- `bin/gstack-platform-detect`：Host 检测脚本
- `scripts/host-config-export.ts`：配置导出工具（4 个命令：list/get/detect/validate）
- `scripts/resolvers/index.ts`：38 个 resolver 注册表
- `scripts/resolvers/preamble.ts`：运行时环境检测（usesEnvVars 分支）
- `scripts/resolvers/browse.ts`：多 Host 浏览工具发现
- `openclaw/gstack-*.md`：OpenClaw 的 CLAUDE.md 注入方案
- `docs/ADDING_A_HOST.md`：添加新 Host 的完整指南

---

## 8.1 运行时配置消费：preamble.ts 的 usesEnvVars 分支

### 两套环境变量策略

preamble.ts 中，根据 HostConfig.usesEnvVars 字段生成两种不同的 Bash 前导脚本：

**Claude（usesEnvVars = false）**：

```bash
# Claude 使用 literal ~ 路径，无 GSTACK_ROOT 变量
mkdir -p ~/.claude/skills/gstack/bin
~/.claude/skills/gstack/bin/gstack-update-check
```

**其他所有 Host（usesEnvVars = true）**：

```bash
# 使用 GSTACK_ROOT 环境变量动态计算路径
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
GSTACK_ROOT="$HOME/.opencode/skills/gstack"
[ -n "$_ROOT" ] && [ -d "$_ROOT/.opencode/skills/gstack" ] && GSTACK_ROOT="$_ROOT/.opencode/skills/gstack"
GSTACK_BIN="$GSTACK_ROOT/bin"
GSTACK_BROWSE="$GSTACK_ROOT/browse/dist"
```

这导致 Claude 的 SKILL.md 使用绝对路径 `~/.claude/...`，其他 Host 使用 `$GSTACK_ROOT/...` 环境变量——这正是为什么 Claude 不需要 pathRewrites，而其他所有 Host 都需要。

---

## 8.2 多 Host 浏览工具发现

### find-browse Shim 架构

`browse/bin/find-browse` 是一个 POSIX shim，分三层发现浏览二进制：

```bash
# Layer 1: 编译二进制（workspace-local build）
DIR="$(cd "$(dirname "$0")/.." && pwd)/dist"
if test -x "$DIR/find-browse"; then
  exec "$DIR/find-browse" "$@"
fi

# Layer 2: 遍历所有 Host 目录查找
ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
for MARKER in .codex .agents .claude; do
  if [ -n "$ROOT" ] && [ -x "$ROOT/$MARKER/skills/gstack/browse/dist/browse" ]; then
    echo "$ROOT/$MARKER/skills/gstack/browse/dist/browse"
    exit 0
  fi
  if [ -x "$HOME/$MARKER/skills/gstack/browse/dist/browse" ]; then
    echo "$HOME/$MARKER/skills/gstack/browse/dist/browse"
    exit 0
  fi
done

# Layer 3: 报错
echo "ERROR: browse binary not found." >&2
exit 1
```

Layer 2 的 `.codex` 和 `.agents` 标记是为了兼容 Codex 的 sidecar 配置。这是 gstack 对多 Host 环境的优雅降级处理。

### browse.ts resolver 的路径发现

`browse.ts` 的 `generateBrowseSetup()` 使用同样的策略生成 SKILL.md 中的 setup 检查脚本——检查本地路径优先（项目内 .opencode/skills/gstack/browse/dist/browse），其次全局路径：

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
B=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/.opencode/skills/gstack/browse/dist/browse" ] && B="$_ROOT/.opencode/skills/gstack/browse/dist/browse"
[ -z "$B" ] && B=$HOME/.opencode/skills/gstack/browse/dist/browse
```

---

## 8.3 Host 配置导出系统

### host-config-export.ts：四命令工具

`scripts/host-config-export.ts` 是一个 bun 脚本，导出 HostConfig 给 bash 消费：

```bash
# 列出所有 Host 名称
bun run host-config-export.ts list
# → claude
# → codex
# → factory
# → kiro
# → ...

# 查询单个字段
bun run host-config-export.ts get codex cliCommand
# → codex

# 检测已安装的 Host
bun run host-config-export.ts detect
# → claude
# → codex

# 验证所有配置
bun run host-config-export.ts validate
# → All 8 configs valid
```

### gstack-platform-detect 的实现

`bin/gstack-platform-detect` 使用 host-config-export.ts 实现跨平台检测：

```bash
for host in $(bun run host-config-export.ts list 2>/dev/null); do
  cmd=$(bun run host-config-export.ts get "$host" cliCommand)
  root=$(bun run host-config-export.ts get "$host" globalRoot)
  spath="$HOME/$root"

  if command -v "$cmd" >/dev/null 2>&1; then
    ver=$("$cmd" --version 2>/dev/null | head -1 || echo "unknown")
    if [ -d "$spath" ] || [ -L "$spath" ]; then
      status="INSTALLED"
    else
      status="NOT INSTALLED"
    fi
    printf "%-16s %-10s %-40s %s\n" "$host" "$ver" "$spath" "$status"
  fi
done
```

输出示例：

```
Agent            Version     Skill Path                              gstack
-----            -------     ----------                              ------
claude           1.0.42      ~/.claude/skills/gstack                 INSTALLED
codex            0.18.2      ~/.codex/skills/gstack                  INSTALLED
cursor           0.42.1      ~/.cursor/skills/gstack                 NOT INSTALLED
```

### validateAllConfigs 的检查项

host-config-export.ts 的 `validate` 命令调用 `validateAllConfigs()`：

- 单配置验证：name 格式、cliCommand 格式、路径字符合法性、frontmatter.mode 合法性、linkingStrategy 合法性
- 跨配置验证：name/hostSubdir/globalRoot 全局唯一性

---

## 8.4 Resolver 注册表

### 38 个 Resolver

`scripts/resolvers/index.ts` 导出 RESOLVERS 记录（Record<string, ResolverFn>），共 38 个 resolver，覆盖 7 个领域：

**Slug 与标识**（2 个）：
- SLUG_EVAL、SLUG_SETUP

**浏览工具**（3 个）：
- COMMAND_REFERENCE、SNAPSHOT_FLAGS、BROWSE_SETUP

**Preamble**（2 个）：
- PREAMBLE、TEST_FAILURE_TRIAGE

**设计审查**（7 个）：
- DESIGN_METHODOLOGY、HARD_RULES、OUTSIDE_VOICES、REVIEW_LITE、SKETCH、SETUP、MOCKUP、SHOTGUN_LOOP

**测试**（4 个）：
- TEST_BOOTSTRAP、TEST_COVERAGE_AUDIT_PLAN/SHIP/REVIEW

**审查**（11 个）：
- REVIEW_DASHBOARD、PLAN_FILE_REVIEW_REPORT、SPEC_REVIEW_LOOP、CODEX_SECOND_OPINION、ADVERSARIAL_STEP、SCOPE_DRIFT、CODEX_PLAN_REVIEW、PLAN_COMPLETION_AUDIT_SHIP/REVIEW、PLAN_VERIFICATION_EXEC、BENEFITS_FROM

**运维与学习**（9 个）：
- DEPLOY_BOOTSTRAP、CO_AUTHOR_TRAILER、CHANGELOG_WORKFLOW、LEARNINGS_SEARCH/LOG、CONFIDENCE_CALIBRATION、INVOKE_SKILL、REVIEW_ARMY、DX_FRAMEWORK、BASE_BRANCH_DETECT、QA_METHODOLOGY

### Resolver 的 Suppression 机制

suppressedResolvers 在 gen-skill-docs.ts 执行时生效：resolver 函数照常运行，但在 Host 适配层被过滤返回空字符串。resolver 函数本身不知道也不需要知道哪个 Host 压制了它——解耦彻底。

---

## 8.5 OpenClaw：混合架构

### CLAUDE.md 注入方案

OpenClaw 有自己独特的集成方式——不使用 SKILL.md，而是生成 CLAUDE.md 片段并注入：

```
openclaw/
├── gstack-plan-CLAUDE.md    # OpenClaw 专用 plan 注入脚本
├── gstack-lite-CLAUDE.md    # OpenClaw 专用 lite 版本
└── gstack-full-CLAUDE.md    # OpenClaw 专用 full 版本
```

gstack-plan-CLAUDE.md 内容揭示了 OpenClaw 的编排模式：

1. 读取 CLAUDE.md 理解项目上下文
2. 运行 /office-hours 产生设计文档
3. 运行 /autoplan 执行完整审查（CEO + eng + design + DX + codex adversarial）
4. 保存到 plans/<slug>-plan-<date>.md
5. 报告给 orchestrator（父会话）

这是**编排器模式（Orchestrator Pattern）**——OpenClaw 作为编排器，通过 gstack 技能执行具体任务，结果汇报回父会话。

### Tool Rewrites 的完整映射

OpenClaw 有最完整的 toolRewrites 映射（不仅改写命令，还改写名词短语）：

```typescript
toolRewrites: {
  'use the Bash tool': 'use the exec tool',
  'use the Write tool': 'use the write tool',
  'use the Read tool': 'use the read tool',
  'use the Edit tool': 'use the edit tool',
  'use the Agent tool': 'use sessions_spawn',
  'use the Grep tool': 'search for',
  'use the Glob tool': 'find files matching',
  'the Bash tool': 'the exec tool',      // 名词短语也要改写
  'the Read tool': 'the read tool',
  'the Write tool': 'the write tool',
  'the Edit tool': 'the edit tool',
}
```

---

## 8.6 添加新 Host 的完整流程

ADDING_A_HOST.md 提供了 6 步完整指南：

### 步骤 1：创建配置文件

复制 `hosts/opencode.ts` 作为起点，创建 `hosts/myhost.ts`。声明 HostConfig，设置 name、displayName、cliCommand、globalRoot、pathRewrites 等字段。

### 步骤 2：注册到 index.ts

添加到 ALL_HOST_CONFIGS 数组，并添加到 re-exports。TypeScript 联合类型自动扩展。

### 步骤 3：加入 .gitignore

添加 `.myhost/`。

### 步骤 4：生成与验证

```bash
bun run gen:skill-docs --host myhost
grep -r ".claude/skills" .myhost/skills/ | head -5  # 应为空
bun run gen:skill-docs --host all  # 重新生成全部
```

### 步骤 5：运行测试

```bash
bun test test/gen-skill-docs.test.ts
bun test test/host-config.test.ts
```

参数化烟雾测试自动覆盖新 Host，无需修改测试代码。

### 步骤 6：更新 README.md

添加新 Host 的安装说明。

---

## 8.7 8 大 AI 代理生态全景

| Agent | 角色 | CLI | Skills 路径 | 工具模型 | 特殊设计 |
|-------|------|-----|------------|---------|---------|
| **Claude Code** | 主 Host | claude | ~/.claude/skills/gstack | Agent tool（原生） | denylist frontmatter, prefixable |
| **OpenAI Codex CLI** | 副标杆 | codex / agents | ~/.codex/skills/gstack | dispatch subagent | openai.yaml metadata, boundary |
| **Factory Droid** | GitHub 内嵌 | droid | ~/.factory/skills/gstack | dispatch subagent | conditionalFields, full learnings |
| **Cursor** | IDE 集成 | cursor | ~/.cursor/skills/gstack | 原生 | allowlist frontmatter |
| **Kiro** | AWS 生态 | kiro-cli | ~/.kiro/skills/gstack | 原生 | allowlist, XDG 路径兼容 |
| **Slate** | Random Labs | slate | ~/.slate/skills/gstack | 原生 | allowlist |
| **OpenCode** | XDG 规范 | opencode | ~/.config/opencode/skills/gstack | 原生 | XDG Base Directory 规范 |
| **OpenClaw** | 编排器 | openclaw | ~/.openclaw/skills/gstack | sessions_spawn | CLAUDE.md 注入, adapter 模式 |

---

## 关键发现

1. **usesEnvVars 是区分 Claude 与其他 Host 的关键配置**：这导致 Claude 使用 literal `~/.claude/` 路径（无需改写），其他 Host 使用 `$GSTACK_ROOT` 环境变量（需要改写）。

2. **resolver 层与 Host 适配层完全解耦**：resolver 函数不知道也不关心哪个 Host 调用它；Host 适配层在 resolver 输出之上做压制和改写。

3. **find-browse 的 Host 枚举设计**：Layer 2 硬编码了 `.codex` 和 `.agents` 两个标记——这是为了兼容 Codex 的 sidecar 配置。如果未来有更多 Host 用 sidecar，需要更新这个枚举。

4. **OpenClaw 的双重集成**：OpenClaw 既使用 HostConfig（pathRewrites、toolRewrites、suppressedResolvers），又使用 CLAUDE.md 注入脚本作为高级编排层。

5. **烟雾测试自动覆盖新 Host**：`test/gen-skill-docs.test.ts` 和 `test/host-config.test.ts` 通过参数化遍历 ALL_HOST_CONFIGS 动态测试，无需为新 Host 编写测试代码。
