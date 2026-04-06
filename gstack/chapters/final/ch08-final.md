# 第8章：8 大 AI 代理支持——配置即生态

第 7 章讲解了 HostConfig 接口的定义和声明——这是静态的配置层。本章深入 gstack 的运行时集成——这些配置如何在构建、检测、安装、执行各环节被消费。两条线交织在一起，构成了 gstack 完整的多代理生态。

gstack 目前正式支持 8 种 AI 代理（按加入时间排序）：

```
Claude Code → OpenAI Codex CLI → Cursor → OpenCode → Factory Droid
→ Kiro → Slate → OpenClaw
```

每种代理都有独特的工具模型、目录布局和使用场景。本章逐一解析它们与 gstack 的集成方式，以及 gstack 的工具链如何围绕 HostConfig 统一运作。

---

## 8.1 运行时配置消费：preamble 的两条路径

### usesEnvVars 的本质

第 7 章提到，所有非 Claude Host 都设置 `usesEnvVars: true`。这个字段不是装饰性的——它直接影响 preamble.ts 生成的 Bash 前导脚本内容。

**Claude 模式（usesEnvVars = false）**：

```bash
mkdir -p ~/.claude/skills/gstack/bin
~/.claude/skills/gstack/bin/gstack-update-check
```

**其他 Host 模式（usesEnvVars = true）**：

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
GSTACK_ROOT="$HOME/.opencode/skills/gstack"
[ -n "$_ROOT" ] && [ -d "$_ROOT/.opencode/skills/gstack" ] && GSTACK_ROOT="$_ROOT/.opencode/skills/gstack"
GSTACK_BIN="$GSTACK_ROOT/bin"
GSTACK_BROWSE="$GSTACK_ROOT/browse/dist"
GSTACK_DESIGN="$GSTACK_ROOT/design/dist"
```

这解释了为什么 Claude 的 pathRewrites 是空数组——Claude 直接用 literal `~/.claude/` 路径，不需要环境变量替换。其他 7 个 Host 则依赖 `$GSTACK_ROOT` 动态计算，pathRewrites 把模板中的 `.claude/skills/gstack` 替换成各 Host 的实际子目录。

### 全局 Symlink 资产的 Host 一致性

一个值得注意的设计决策：所有 Host 的 `runtimeRoot.globalSymlinks` 完全相同：

```typescript
runtimeRoot: {
  globalSymlinks: ['bin', 'browse/dist', 'browse/bin', 'gstack-upgrade', 'ETHOS.md'],
  globalFiles: { 'review': ['checklist.md', 'TODOS-format.md'] }
}
```

这意味着 bin/（gstack 工具集）、browse/（浏览器工具）、gstack-upgrade（升级脚本）、ETHOS.md（工程伦理文档）在所有 Host 上都以相同的方式被链接安装。gstack 的工具链对所有 Host 一视同仁——差异只在路径映射层。

---

## 8.2 Host 检测与平台发现

### gstack-platform-detect

`bin/gstack-platform-detect` 是 gstack 的"主机发现"工具，用纯 Bash 编写，读取 host-config-export.ts 的输出：

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

运行效果：

```
Agent            Version     Skill Path                              gstack
-----            -------     ----------                              ------
claude           1.0.42      ~/.claude/skills/gstack                 INSTALLED
codex            0.18.2      ~/.codex/skills/gstack                  INSTALLED
cursor           0.42.1      ~/.cursor/skills/gstack                 NOT INSTALLED
factory          2.1.0       ~/.factory/skills/gstack                INSTALLED
```

这个脚本不需要硬编码任何 Host 信息——它通过 host-config-export.ts 动态获取所有 Host 的 cliCommand 和 globalRoot。如果添加了新 Host，脚本自动包含它，无需修改。

### host-config-export.ts：四命令工具

`scripts/host-config-export.ts` 是 Host 配置的导出层，提供 4 个命令：

```bash
bun run host-config-export.ts list       # 列出所有 Host 名称
bun run host-config-export.ts get <host> <field>  # 查询字段值
bun run host-config-export.ts detect     # 检测已安装的 Host
bun run host-config-export.ts validate    # 验证所有配置
```

`detect` 命令遍历 ALL_HOST_CONFIGS，对每个 Host 执行 `command -v cliCommand`，找到 PATH 上存在的二进制：

```typescript
case 'detect': {
  for (const config of ALL_HOST_CONFIGS) {
    const commands = [config.cliCommand, ...(config.cliAliases || [])];
    for (const cmd of commands) {
      try {
        execSync(`command -v ${shellEscape(cmd)}`, { stdio: 'pipe' });
        console.log(config.name);
        break;
      } catch { /* 尝试下一个别名 */ }
    }
  }
  break;
}
```

注意 Factory 的 `cliAliases: ['droid']`——即使用户安装的是 `droid` 二进制，检测也能找到 `factory`。

### 配置验证：构建时质量门

`validate` 命令在构建阶段确保配置质量：

```bash
bun run host-config-export.ts validate
# → All 8 configs valid
```

如果开发者添加了一个 Host 但忘了更新 ALL_HOST_CONFIGS 数组，validate 会报告"配置未注册"。如果两个 Host 使用了相同的 hostSubdir，validate 会报告"全局唯一性冲突"。

---

## 8.3 多 Host 浏览工具发现

### find-browse 的三层架构

`browse/bin/find-browse` 是 gstack 浏览工具的发现 shim，分三层寻找浏览二进制：

```bash
# Layer 1: 编译二进制（workspace-local build）
DIR="$(cd "$(dirname "$0")/.." && pwd)/dist"
if test -x "$DIR/find-browse"; then
  exec "$DIR/find-browse" "$@"
fi

# Layer 2: 遍历所有 Host 目录
ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
for MARKER in .codex .agents .claude; do
  if [ -n "$ROOT" ] && [ -x "$ROOT/$MARKER/skills/gstack/browse/dist/browse" ]; then
    echo "$ROOT/$MARKER/skills/gstack/browse/dist/browse"; exit 0
  fi
  if [ -x "$HOME/$MARKER/skills/gstack/browse/dist/browse" ]; then
    echo "$HOME/$MARKER/skills/gstack/browse/dist/browse"; exit 0
  fi
done

# Layer 3: 报错
echo "ERROR: browse binary not found." >&2; exit 1
```

Layer 2 硬编码了 `.codex` 和 `.agents` 两个标记——这是因为 Codex 使用 `.agents/` 作为本地侧车路径（见第 7 章）。当 browse/dist/browse 存在于任意一个 Host 的技能目录下时，find-browse 就能找到它。

### SKILL.md 中的 Browse Setup

browse.ts 的 `generateBrowseSetup()` 生成 SKILL.md 中的运行时检查脚本，使用相同的优先级策略：项目内本地路径优先于全局路径：

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
B=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/.opencode/skills/gstack/browse/dist/browse" ] && B="$_ROOT/.opencode/skills/gstack/browse/dist/browse"
[ -z "$B" ] && B=$HOME/.opencode/skills/gstack/browse/dist/browse
if [ -x "$B" ]; then
  echo "READY: $B"
else
  echo "NEEDS_SETUP"
fi
```

如果输出 `NEEDS_SETUP`，技能会提示用户运行 `cd <SKILL_DIR> && ./setup` 来构建浏览工具。

---

## 8.4 Resolver 注册表与动态分发

### 41 个 Resolver 的领域划分

`scripts/resolvers/index.ts` 定义了 gstack 的全部 resolver，形成一个查找表：

```typescript
export const RESOLVERS: Record<string, ResolverFn> = {
  // Slug 与标识（2）
  SLUG_EVAL: generateSlugEval,
  SLUG_SETUP: generateSlugSetup,

  // 浏览工具（3）
  COMMAND_REFERENCE: generateCommandReference,
  SNAPSHOT_FLAGS: generateSnapshotFlags,
  BROWSE_SETUP: generateBrowseSetup,

  // Preamble（2）
  PREAMBLE: generatePreamble,
  TEST_FAILURE_TRIAGE: generateTestFailureTriage,

  // 设计审查（8）
  DESIGN_METHODOLOGY: generateDesignMethodology,
  DESIGN_HARD_RULES: generateDesignHardRules,
  DESIGN_OUTSIDE_VOICES: generateDesignOutsideVoices,
  DESIGN_REVIEW_LITE: generateDesignReviewLite,
  DESIGN_SKETCH: generateDesignSketch,
  DESIGN_SETUP: generateDesignSetup,
  DESIGN_MOCKUP: generateDesignMockup,
  DESIGN_SHOTGUN_LOOP: generateDesignShotgunLoop,

  // 测试（4）
  TEST_BOOTSTRAP: generateTestBootstrap,
  TEST_COVERAGE_AUDIT_PLAN: generateTestCoverageAuditPlan,
  TEST_COVERAGE_AUDIT_SHIP: generateTestCoverageAuditShip,
  TEST_COVERAGE_AUDIT_REVIEW: generateTestCoverageAuditReview,

  // 审查（11）
  REVIEW_DASHBOARD: generateReviewDashboard,
  PLAN_FILE_REVIEW_REPORT: generatePlanFileReviewReport,
  SPEC_REVIEW_LOOP: generateSpecReviewLoop,
  CODEX_SECOND_OPINION: generateCodexSecondOpinion,
  ADVERSARIAL_STEP: generateAdversarialStep,
  SCOPE_DRIFT: generateScopeDrift,
  CODEX_PLAN_REVIEW: generateCodexPlanReview,
  PLAN_COMPLETION_AUDIT_SHIP: generatePlanCompletionAuditShip,
  PLAN_COMPLETION_AUDIT_REVIEW: generatePlanCompletionAuditReview,
  PLAN_VERIFICATION_EXEC: generatePlanVerificationExec,
  BENEFITS_FROM: generateBenefitsFrom,

  // 运维与学习（8）
  DEPLOY_BOOTSTRAP: generateDeployBootstrap,
  BASE_BRANCH_DETECT: generateBaseBranchDetect,
  QA_METHODOLOGY: generateQAMethodology,
  CO_AUTHOR_TRAILER: generateCoAuthorTrailer,
  CHANGELOG_WORKFLOW: generateChangelogWorkflow,
  LEARNINGS_SEARCH: generateLearningsSearch,
  LEARNINGS_LOG: generateLearningsLog,
  CONFIDENCE_CALIBRATION: generateConfidenceCalibration,

  // 编排（3）
  INVOKE_SKILL: generateInvokeSkill,
  REVIEW_ARMY: generateReviewArmy,
  DX_FRAMEWORK: generateDxFramework,
};
```

### Resolver 的 Suppression 机制

gen-skill-docs.ts 执行 resolver 时，先查 HostConfig.suppressedResolvers——如果 resolver 名称在数组中，返回空字符串，跳过注入：

```
PREGEN: 解析 {{DESIGN_OUTSIDE_VOICES}}
PREGEN: Host codex — suppressedResolvers 包含 DESIGN_OUTSIDE_VOICES → skip
PREGEN: 输出: (空)
```

resolver 函数本身不知道哪个 Host 调用了它——完全解耦。这是良好的关注点分离设计：resolver 负责内容生成，Host 适配层负责内容过滤。

---

## 8.5 8 大 AI 代理集成详解

### Claude Code：主 Host

Claude Code 是 gstack 的设计原点，所有其他 Host 的配置都是相对于 Claude 的差异化描述。集成特点：

- 工具：Agent tool（原生支持）
- Skills 路径：`~/.claude/skills/gstack/`
- 前导脚本：无 GSTACK_ROOT 环境变量，使用 literal 路径
- 安装：`real-dir-symlink`，符号链接直接指向 generated 内容
- 安装前缀：`prefixable = true`（支持 `gstack-config skill_prefix`）

### OpenAI Codex CLI：副标杆

Codex 是测试最严格的目标，有几项独特设计：

- 工具：dispatch subagent（通过 `subagent_type: "general-purpose"` 调用子代理）
- Skills 路径：`~/.codex/skills/gstack/`，另有 `.agents/` 本地侧车
- 前导脚本：使用 `$GSTACK_ROOT` 环境变量
- 元数据：生成 `openai.yaml`
- 边界指令：防止误读 Claude 技能文件

### Cursor：IDE 集成

Cursor 的 Skills 目录布局与 Claude Code 高度相似，因此配置最简洁：

- 工具：原生（无 Agent tool）
- Skills 路径：`~/.cursor/skills/gstack/`
- 前导脚本：使用 `$GSTACK_ROOT`
- 无 toolRewrites（工具名与 Claude 足够接近）
- 无 suppressedResolvers（无递归调用场景）

### OpenCode：XDG 规范

OpenCode 遵循 XDG Base Directory 规范，Skills 放在配置目录而非主目录：

- Skills 路径：`~/.config/opencode/skills/gstack/`
- 这也是它与 Claude 差异最大的路径——需要完整的 pathRewrites

### Factory Droid：GitHub 内嵌

Factory Droid 运行在 GitHub 内部，coAuthorTrailer 指向 GitHub 的 co-author 格式：

- `coAuthorTrailer: 'Co-Authored-By: Factory Droid <droid@users.noreply.github.com>'`
- CLI 别名：`droid`（通过 `codex agents droid` 调用）
- learningsMode：`full`（支持跨项目学习）
- 使用 conditionalFields：根据 `sensitive: true` 自动注入 `disable-model-invocation`

### Kiro：AWS 生态

Kiro 的独特之处在于 pathRewrites 同时覆盖 Claude 和 Codex 的路径：

```typescript
pathRewrites: [
  { from: '~/.claude/skills/gstack', to: '~/.kiro/skills/gstack' },
  { from: '~/.codex/skills/gstack', to: '~/.kiro/skills/gstack' },
]
```

这使 Kiro 能同时读取 Claude 和 Codex 生态中已有的 gstack 安装。

### Slate：Random Labs

Slate 的配置最为简洁——几乎所有字段都是默认值，无特殊设计。Random Labs 的 Slate 编辑器目前处于早期集成阶段。

### OpenClaw：编排器架构

OpenClaw 是 8 个 Host 中最复杂的一个，同时使用两套集成机制：

**机制一：HostConfig 适配**（与普通 Host 相同）：
- pathRewrites、toolRewrites、suppressedResolvers 全部生效
- suppressedResolvers 有 5 项（与 Codex 相同）

**机制二：CLAUDE.md 注入**（OpenClaw 独有）：

```
openclaw/
├── gstack-plan-CLAUDE.md    # 完整审查方案
├── gstack-lite-CLAUDE.md    # 精简版
└── gstack-full-CLAUDE.md    # 全功能版
```

gstack-plan-CLAUDE.md 揭示了 OpenClaw 的编排流程：

```
1. 读取 CLAUDE.md 理解项目上下文
2. 运行 /office-hours 产生设计文档
3. 运行 /autoplan 执行完整审查
4. 保存审查结果到 plans/<slug>-plan-<date>.md
5. 报告给父会话（orchestrator）
```

这是**编排器模式**——OpenClaw 作为父会话，gstack 技能作为被调用的子任务。OpenClaw 负责高层决策，gstack 负责具体执行。

---

## 8.6 添加新 Host：端到端流程

`docs/ADDING_A_HOST.md` 提供了完整的 6 步指南。假设要为 Windsurf 添加支持：

### 步骤 1：创建配置文件

复制 `hosts/opencode.ts` 为 `hosts/windsurf.ts`，声明 HostConfig。关键是设置正确的 pathRewrites：

```typescript
pathRewrites: [
  { from: '~/.claude/skills/gstack', to: '~/.windsurf/skills/gstack' },
  { from: '.claude/skills/gstack', to: '.windsurf/skills/gstack' },
  { from: '.claude/skills', to: '.windsurf/skills' },
]
```

### 步骤 2：注册到 index.ts

```typescript
import windsurf from './windsurf';
export const ALL_HOST_CONFIGS = [..., windsurf];
export { ..., windsurf };
```

TypeScript 的 `type Host = (typeof ALL_HOST_CONFIGS)[number]['name']` 联合类型自动扩展。

### 步骤 3：加入 .gitignore

```bash
echo ".windsurf/" >> .gitignore
```

### 步骤 4：生成与验证

```bash
bun run gen:skill-docs --host windsurf
grep -r ".claude/skills" .windsurf/skills/  # 应为空
bun run host-config-export.ts validate       # 应通过
```

### 步骤 5：运行测试

```bash
bun test test/gen-skill-docs.test.ts
bun test test/host-config.test.ts
```

参数化烟雾测试自动覆盖新 Host——`gen-skill-docs.test.ts` 遍历 ALL_HOST_CONFIGS，逐一验证每个 Host 的生成产物。无需编写任何新测试代码。

### 步骤 6：更新文档

在 README.md 添加 Windsurf 的安装说明段。

---

## 8.7 本章小结

gstack 的 8 大 AI 代理支持体系展示了一个清晰的分层架构：

**配置层**（第 7 章）：HostConfig 接口声明，pathRewrites / toolRewrites / suppressedResolvers 定义

**工具链层**（本章）：host-config-export.ts（4 命令）、gstack-platform-detect、find-browse shim

**resolver 层**（本章）：41 个 resolver 注册表，动态分发与 suppression 机制

**集成层**（本章）：各 Host 的运行时集成差异，CLAUDE.md 注入（OpenClaw 独有）

这个分层架构的核心价值是**零业务代码修改**添加新 Host。新 Host 的所有信息都在一个 HostConfig 声明中，工具链自动适配，无需修改任何核心逻辑。烟雾测试的自动化覆盖则确保了新 Host 的质量下限。
