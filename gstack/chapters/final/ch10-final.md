# 第 10 章 构建与发布

> **章前语**：本章揭示 gstack 从源码到可发布工件的全流程：构建管道如何将 TypeScript 编译为多平台二进制；setup 脚本如何为不同 Host 端定制安装路径；gstack-update-check 如何平衡版本检查与用户体验；gstack-upgrade 如何在四种安装类型之间优雅升级。本章是全书的收尾，串联起工程化流水线中最易被忽视但至关重要的"最后一公里"。

## 10.1 构建管道

### 10.1.1 编译流水线总览

gstack 的构建以 `package.json` 中的 `build` 脚本为核心，串联 5 个步骤将 TypeScript 源码转换为可直接分发的二进制文件和技能文档：

```
gen:skill-docs (所有 Host)
        ↓
browse/dist/browse        ← browse/src/cli.ts
browse/dist/find-browse   ← browse/src/find-browse.ts
design/dist/design        ← design/src/cli.ts
bin/gstack-global-discover ← bin/gstack-global-discover.ts
        ↓
browse/scripts/build-node-server.sh (Playwright 服务)
        ↓
git rev-parse HEAD → .version (版本戳)
        ↓
chmod +x (设置执行权限)
```

第一步 `gen:skill-docs --host all` 生成所有 Host 格式的技能文档，这是后续编译步骤的前置依赖——browse/dist/browse 需要在运行时查找这些生成的技能文档。编译完成后，git commit hash 被注入到 `browse/dist/.version` 和 `design/dist/.version`，使每个二进制文件与其源码版本精确绑定。

### 10.1.2 智能重建

全量编译在 CI/CD 环境中是标准做法，但在本地开发中，每次保存文件都触发完整构建会严重拖慢迭代速度。gstack 通过 `setup` 脚本中的 `needs_build()` 函数实现基于 mtime 的增量构建：

```bash
browse_src_mtime=$(stat -c %Y "$SOURCE/browse/src" 2>/dev/null || echo 0)
browse_bin_mtime=$(stat -c %Y "$SOURCE/browse/dist/browse" 2>/dev/null || echo 0)
pkg_mtime=$(stat -c %Y "$SOURCE/package.json" 2>/dev/null || echo 0)
lock_mtime=$(stat -c %Y "$SOURCE/bun.lock" 2>/dev/null || echo 0)

if [ "$browse_src_mtime" -gt "$browse_bin_mtime" ] || \
   [ "$pkg_mtime" -gt "$browse_bin_mtime" ] || \
   [ "$lock_mtime" -gt "$browse_bin_mtime" ]; then
  echo "  building gstack..."
  ( cd "$SOURCE" && bun run build )
fi
```

触发条件有三个：源代码文件变更、package.json 变更（新增依赖或修改构建脚本）、bun.lock 变更（依赖版本更新）。只要三者中任一比二进制文件更新，就触发重新编译。这种策略在保留完整类型安全的同时，将本地构建时间从分钟级降至秒级。

### 10.1.3 多格式技能文档生成

`gen:skill-docs` 是构建管道的第一步，也是最容易被忽视的关键环节。不同 AI Agent Host 对技能格式的要求差异巨大：

- **Claude Code** 需要顶级目录结构（`~/.claude/skills/gstack/SKILL.md`）
- **Codex CLI** 扫描 `.agents/skills/` 目录下的 Markdown 文件
- **Kiro CLI** 需要将 `~/.claude/` 路径重写为 `~/.kiro/`
- **Factory Droid** 使用 `.factory/skills/` 目录

`gen:skill-docs --host all` 遍历所有 Host 类型，为每个生成适配其格式的技能文档，同时调整模板中的路径变量（`$CLAUDE_SKILL_DIR`、`$HOME/.codex/skills/gstack` 等）。这一步生成的文档存放在 `.agents/skills/gstack-*` 和 `.factory/skills/gstack-*` 目录，供后续安装步骤使用。

## 10.2 安装流程

### 10.2.1 setup 脚本架构

`setup` 脚本是 gstack 安装体验的核心，全长 767 行，通过参数驱动的模块化设计支持四种 Host 安装。脚本以 `umask 077` 开头，强制所有新创建的文件和目录默认为所有者独享权限，体现了 gstack 一贯的安全优先理念。

主要参数包括：

- `--host <name>`：指定目标 Host（claude / codex / kiro / factory / openclaw / auto）
- `--local`：安装到当前目录的 `.claude/skills/` 而非全局 `~/.claude/skills/`
- `--prefix` / `--no-prefix`：技能命令命名风格（`/gstack-qa` vs `/qa`）
- `--skip-build`：跳过编译步骤（使用预编译的二进制）
- `--no-browser-check`：跳过 Playwright Chromium 验证

### 10.2.2 Claude Code 安装

Claude Code 安装是默认行为。核心逻辑在 `link_claude_skill_dirs()` 函数中：

```bash
for skill_dir in "$gstack_dir"/*/; do
  [ -f "$skill_dir/SKILL.md" ] || continue
  skill_name="$(basename "$skill_dir")"

  # 命名策略：prefix 模式下 gstack-qa，flat 模式下 qa
  if [ "$SKILL_PREFIX" -eq 1 ]; then
    case "$skill_name" in gstack-*) link_name="$skill_name" ;; esac
  fi

  mkdir -p "$target"           # 真实目录（而非符号链接目录）
  ln -snf "$gstack_dir/$dir_name/SKILL.md" "$target/SKILL.md"  # 软链接到源文件
done
```

这个设计精妙之处在于：安装目录是真实目录（mkdir），技能文档是软链接（ln -snf）。这样做有两个好处：第一，Claude Code 的技能加载器期望目录存在；第二，软链接确保源码更新后无需重新安装，链接目标自动指向最新版本。

### 10.2.3 前缀偏好与双向迁移

技能命名风格通过 `~/.gstack/.skill-prefix` 文件持久化存储。首次安装时通过交互式 AskUserQuestion 询问用户偏好：选择扁平风格（`/qa`）还是命名空间风格（`/gstack-qa`）。

当用户切换偏好时，`setup` 执行双向迁移：`cleanup_old_claude_symlinks()` 处理从 flat 到 prefix 的迁移（删除旧的 `~/.claude/skills/qa` 目录），`cleanup_prefixed_claude_symlinks()` 处理反向迁移（删除旧的 `~/.claude/skills/gstack-qa` 目录）。两者都通过 `readlink` 检查链接目标是否指向 gstack 仓库来精确定位待清理项目。

### 10.2.4 Codex 安装与最小化运行时

Codex 安装面临一个独特挑战：Codex 的技能扫描器会递归遍历 `$CODEX_SKILLS` 下的所有目录和文件。如果将整个 gstack 仓库暴露给扫描器，源码中的每个子目录都包含 SKILL.md，导致"重复技能"问题——同一个技能被多次加载。

gstack 通过 **最小化运行时根目录** 解决此问题：

```
~/.codex/skills/gstack/
├── SKILL.md           → .agents/skills/gstack/SKILL.md（生成版）
├── bin/               → 仓库 bin/ 目录的软链接
├── browse/
│   └── dist/          → 编译后的 browse 二进制
└── review/
    ├── checklist.md    → review/ 清单文件的软链接
    └── design-checklist.md
```

运行时根目录仅包含实际运行时代码和资源，源码中的其他技能文档（`.agents/skills/gstack-qa/SKILL.md` 等）通过 `link_codex_skill_dirs()` 链接到 `$CODEX_SKILLS`。

`create_agents_sidecar()` 在 `.agents/skills/gstack/` 下创建 sidecar 目录，包含 `bin/`、`browse/` 等运行时资产链接，使技能模板可以引用 `$SKILL_ROOT/bin/` 这类路径。

### 10.2.5 Kiro 与 Factory 安装

Kiro 安装从 `.agents/skills/` 复制并用 `sed` 重写所有路径变量：

```bash
sed -e "s|~/.claude/skills/gstack|~/.kiro/skills/gstack|g" \
    -e "s|\.claude/skills/gstack|.kiro/skills/gstack|g" \
    -e "s|~/.codex/skills/gstack|~/.kiro/skills/gstack|g" \
    "$SOURCE/SKILL.md" > "$KIRO_GSTACK/SKILL.md"
```

Factory Droid 安装与 Codex 流程平行，使用 `.factory/skills/` 作为生成目标目录，共享同一套 `create_factory_runtime_root()` 和 `link_factory_skill_dirs()` 辅助函数。

### 10.2.6 Playwright 浏览器安装

gstack 的浏览功能依赖 Playwright Chromium。`ensure_playwright_browser()` 函数处理跨平台兼容性：

- **Bun 环境**（非 Windows）：使用 `bunx playwright install chromium`
- **Node.js 环境**（Windows）：使用 `npx playwright install chromium`

这是 Bun 已知 bug（bun#4253）的 workaround：在 Bun 下子进程调用 Playwright 时会阻塞，改用 Node.js 环境运行可规避该问题。setup 脚本通过检测 `$OSTYPE` 判断操作系统类型，选择合适的运行时。

### 10.2.7 首次安装迁移框架

`setup` 末尾的迁移框架是安装体验的重要保障：

```bash
MIGRATIONS_DIR="$SOURCE_GSTACK_DIR/gstack-upgrade/migrations"
CURRENT_VERSION=$(cat "$SOURCE_GSTACK_DIR/VERSION")
LAST_SETUP_VERSION=$(cat "$HOME/.gstack/.last-setup-version")

# 运行：last < m_ver <= current 的迁移
find "$MIGRATIONS_DIR" -maxdepth 1 -name 'v*.sh' -type f | sort -V | \
  while IFS= read -r migration; do
    m_ver="$(basename "$migration" .sh | sed 's/^v//')"
    if version_between "$LAST_SETUP_VERSION" "$m_ver" "$CURRENT_VERSION"; then
      bash "$migration"
    fi
  done
```

迁移脚本处理 setup 本身无法覆盖的状态修复：旧配置文件格式过时、目录结构变更遗留的空目录、第三方工具集成变更等。每个迁移脚本命名为 `v<版本>.sh`，通过版本号比较确保按顺序执行、不重复执行。

## 10.3 版本管理

### 10.3.1 版本双轨制

gstack 使用两个文件追踪版本：

| 文件 | 内容 | 用途 |
|------|------|------|
| `VERSION` | `0.15.9.0`（语义化版本） | 用户可见的版本号，用于升级提示和变更日志 |
| `browse/dist/.version` | git commit hash | 精确追踪构建来源，用于调试和回归定位 |

语义化版本号（SemVer）与 git hash 的组合让 gstack 同时具备人类可读性和机器可追溯性。用户看到的是 `v0.15.9.0`，而开发者排查问题时可以精确定位到具体的 commit。

### 10.3.2 版本检查机制

`bin/gstack-update-check` 是版本检查的核心工具，从 GitHub raw 获取最新版本号并与本地比较：

```bash
REMOTE_VERSION=$(curl -s "https://raw.githubusercontent.com/garrytan/gstack/main/VERSION")
```

返回三种状态：

- `UP_TO_DATE <version>`：本地已是最新
- `UPGRADE_AVAILABLE <old> <new>`：有新版本可用
- 无输出：检查失败（网络问题 / GitHub 不可达）

版本号必须通过有效性验证（格式匹配 `X.Y.Z.W`），否则静默忽略 HTML 错误页面（GitHub 的 404 页面包含 "404" 但不是有效版本号）。

### 10.3.3 缓存与 Snooze

为避免每次 Claude Code 启动都触发网络请求，版本检查结果被缓存到 `~/.gstack/last-update-check`：

```
UP_TO_DATE 0.15.9.0          ← TTL: 60 分钟
UPGRADE_AVAILABLE 0.15.8.0 0.15.9.0  ← TTL: 720 分钟
```

snooze 机制通过 `~/.gstack/update-snoozed` 实现递进延迟：

```
0.15.9.0 1 1743456789        ← Snooze Level 1: 24 小时
0.15.9.0 2 1743543189        ← Snooze Level 2: 48 小时
0.15.9.0 3 1744061589        ← Snooze Level 3+: 168 小时（7 天）
```

用户反复推迟更新时，延迟时间指数级增长。新版本出现时 snooze 计数器重置，因为新版本可能包含重要功能或修复，用户应该知道。

### 10.3.4 Codex Description 迁移

gstack 历史上曾为 Codex 生成过超长的 `description:` 字段（包含完整的技能使用说明），导致 Claude Code 加载时出现警告。该迁移脚本扫描 `~/.claude/skills/gstack-*/SKILL.md`，删除超过 1024 字符的 `description:` 字段。这是一次性的清理操作，运行后将 `description:` 还原为简洁的单行描述。

## 10.4 升级机制

### 10.4.1 安装类型检测

gstack-upgrade 首先检测当前安装类型，这是决定升级策略的前提：

```bash
# global-git: 克隆版在全局目录
if [ -d "$HOME/.claude/skills/gstack/.git" ]; then
  INSTALL_TYPE="global-git"
  INSTALL_DIR="$HOME/.claude/skills/gstack"

# local-git: 克隆版在工作目录
elif [ -d "$(pwd)/.claude/skills/gstack/.git" ]; then
  INSTALL_TYPE="local-git"
  INSTALL_DIR="$(pwd)/.claude/skills/gstack"

# vendored: 直接复制版
elif [ -f "$INSTALL_DIR/SKILL.md" ]; then
  if [ -L "$HOME/.claude/skills/gstack" ]; then
    INSTALL_TYPE="vendored-global"
  else
    INSTALL_TYPE="vendored"
  fi
fi
```

git 目录的存在与否是区分克隆版和复制版的关键标志。克隆版可以通过 `git pull` 升级，复制版需要重新下载替换。

### 10.4.2 git 升级流程

对于 global-git 和 local-git 安装，升级利用 git 的版本控制能力：

```bash
cd "$INSTALL_DIR"
git stash              # 暂存本地修改
git fetch origin       # 拉取远程更新
git reset --hard origin/main  # 强制重置到远程最新
./setup                # 重新运行安装后配置
```

`git stash` 保留本地自定义（如果有），`reset --hard` 确保干净状态。setup 重新执行链接更新、迁移脚本运行等安装后步骤。

### 10.4.3 vendored 升级流程

复制版没有 git 历史，升级策略是完整的目录替换：

```bash
git clone --depth 1 https://github.com/garrytan/gstack /tmp/gstack-upgrade
mv "$INSTALL_DIR" "$INSTALL_DIR.bak"  # 备份（升级失败可回滚）
mv /tmp/gstack-upgrade "$INSTALL_DIR"
cd "$INSTALL_DIR" && ./setup
rm -rf "$INSTALL_DIR.bak"
```

备份目录 `.bak` 是关键的安全措施——如果 `./setup` 失败，用户可以从备份恢复，升级过程不会破坏已有配置。

### 10.4.4 升级交互流程

gstack-upgrade 通过 5 个选项的 AskUserQuestion 提供灵活的升级控制：

```
gstack-upgrade 发现新版本 v0.16.0.0（当前 v0.15.9.0）

1. Yes, upgrade now
2. Always keep me up to date  ← 设置自动升级标志
3. Not now                   ← Snooze Level 1
4. Never ask again           ← 彻底关闭
5. Show changelog first

（自动升级时跳过此问题，直接执行选项 1）
```

"Always keep me up to date" 通过写入配置文件（`~/.gstack/auto-upgrade`）实现。gstack-update-check 在下次运行时读取该文件，自动选择升级路径而不再次询问。

### 10.4.5 本地副本同步

当同时存在全局安装和 repo-local vendored 安装时，gstack-upgrade 会自动同步两者：

```bash
# 检测本地副本
if [ -d "$(pwd)/.claude/skills/gstack" ]; then
  LOCAL_GSTACK="$(pwd)/.claude/skills/gstack"
fi

# 比较版本
PRIMARY_VER=$(cat "$INSTALL_DIR/VERSION")
LOCAL_VER=$(cat "$LOCAL_GSTACK/VERSION")

if [ "$PRIMARY_VER" != "$LOCAL_VER" ]; then
  # 同步更新本地副本
fi
```

这确保了项目的 repo-local 安装（通过 `.claude/skills/gstack/` 提交到 git）始终与全局安装保持一致。

### 10.4.6 升级中的迁移脚本

升级流程与安装流程平行地运行迁移脚本（gstack-upgrade/migrations/v*.sh），处理 setup 无法覆盖的升级特有场景：例如从 v0.14 升级到 v0.16 时，中间跳过的 v0.15 版本的某些状态变更需要专门处理。

## 10.5 安全与隐私

### 10.5.1 隐私保护

版本检查过程中的遥测 ping 是非阻塞后台请求（`&` 挂起），尊重 `telemetry: off` 配置。即使 Supabase 服务不可达或响应慢，也不会阻塞版本检查流程。缓存机制确保版本检查结果被复用，减少不必要的网络请求。

### 10.5.2 文件权限

`umask 077` 确保安装过程中创建的所有文件默认具有最严格权限。gstack 不向系统目录写入任何内容，所有用户级配置存储在 `~/.gstack/` 个人目录下。

### 10.5.3 备份保护

vendored 升级前的目录备份（`.bak` 后缀）是防止升级失败导致配置丢失的关键保护。备份目录在 `./setup` 成功完成后才被删除，确保任何步骤失败都有可恢复的起点。

## 10.6 本章小结

本章揭示了 gstack 构建与发布体系的全貌，涵盖从源码到用户设备的完整链路：

**构建管道**方面，5 步流水线将 TypeScript 编译为多平台二进制，mtime 驱动的智能重建将本地构建时间从分钟级降至秒级，`gen:skill-docs` 为四个 Host 生成差异化技能文档。

**安装流程**方面，767 行的 setup 脚本以模块化设计支持 Claude Code、Codex、Kiro、Factory 四个 Host，技能目录链接策略兼顾可更新性（软链接到源码）和兼容性（真实目录满足 Host 扫描器），前缀偏好迁移实现平滑的风格切换。

**版本管理**方面，双轨版本号（SemVer + git hash）同时服务用户可见性和开发者可追溯性，缓存与 snooze 机制平衡版本检查频率与用户体验，迁移框架确保跨版本升级时状态一致性。

**升级机制**方面，四种安装类型（global-git / local-git / vendored / vendored-global）各有其升级策略，git 克隆版利用版本控制能力实现无损升级，复制版通过完整目录替换和 `.bak` 备份确保安全回滚。

下一章将对全书的架构设计进行回顾与展望，提炼 gstack 作为一个工程化流水线的核心设计哲学。
