# ch10 研究报告：构建与发布

## 10.0 概述

本章研究 gstack 的构建管道、安装流程与发布机制，涵盖三个核心系统：

- **构建管道**：从源码到多平台二进制的完整编译流程（package.json build 脚本）
- **安装与设置**：./setup 脚本如何为 Claude Code、Codex、Kiro CLI、Factory Droid 四种 Host 分别配置
- **版本管理与升级**：gstack-update-check 版本检查机制、gstack-upgrade 升级流程、四种安装类型与迁移框架

---

## 10.1 构建管道

### 10.1.1 package.json build 脚本

package.json 中的 `build` 脚本定义了完整构建流水线，共 4 个二进制编译步骤：

```bash
# Step 1: 生成所有 Host 的技能文档
bun run gen:skill-docs --host all

# Step 2: 编译 browse CLI（主命令）
bun build --compile browse/src/cli.ts → browse/dist/browse

# Step 3: 编译 find-browse（多 Host 浏览工具发现）
bun build --compile browse/src/find-browse.ts → browse/dist/find-browse

# Step 4: 编译 design CLI（设计评审工具）
bun build --compile design/src/cli.ts → design/dist/design

# Step 5: 编译全局发现器
bun build --compile bin/gstack-global-discover.ts → bin/gstack-global-discover

# Step 6: 构建 node-server（Playwright 服务）
bash browse/scripts/build-node-server.sh

# Step 7: 版本戳注入
git rev-parse HEAD > browse/dist/.version && design/dist/.version

# Step 8: 权限与清理
chmod +x browse/dist/browse browse/dist/find-browse design/dist/design bin/gstack-global-discover
rm -f .*.bun-build
```

### 10.1.2 智能重建（Smart Rebuild）

setup 脚本中的 `needs_build()` 函数实现了基于 mtime 的增量构建：

```bash
# 条件：源代码变更 OR 依赖变更
if [ "$browse_src_mtime" -gt "$browse_bin_mtime" ] || \
   [ "$pkg_mtime" -gt "$browse_bin_mtime" ] || \
   [ "$lock_mtime" -gt "$browse_bin_mtime" ]; then
  NEEDS_BUILD=1
fi
```

仅当 browse/src/ 下文件、package.json 或 bun.lock 变更时才触发重新编译。编译后的二进制文件作为后续检查的基准时间戳。

### 10.1.3 版本注入机制

构建完成后，通过 `git rev-parse HEAD` 获取当前 commit hash，注入到 `browse/dist/.version` 和 `design/dist/.version`。VERSION 文件记录语义化版本号（当前 0.15.9.0），两个文件共同追踪构建的精确来源。

---

## 10.2 安装流程：./setup

### 10.2.1 安全基础：umask 077

setup 脚本首行强制 `umask 077`，确保所有新创建的文件和目录默认为所有者独享权限（文件 0o600，目录 0o700），与 gstack 的安全哲学一致。

### 10.2.2 Host 参数解析

setup 支持 `--host` 参数指定目标 Host：

| 参数值 | 说明 |
|--------|------|
| `claude` | 仅安装 Claude Code 技能（默认） |
| `codex` | 仅安装 Codex CLI 技能 |
| `kiro` | 安装 Kiro CLI 技能 |
| `factory` | 安装 Factory Droid 技能 |
| `openclaw` | 输出提示信息（OpenClaw 无特殊安装需求） |
| `auto` | 自动检测已安装的 Host |

`--local` 标志将安装路径从 `~/.claude/skills/` 改为当前工作目录 `./.claude/skills/`（repo-local 安装）。

`--prefix` / `--no-prefix` 决定技能命令的前缀风格：
- `--prefix`（默认）：`/gstack-qa`、`/gstack-review`（带命名空间）
- `--no-prefix`：`/qa`、`/review`（扁平风格）

偏好设置通过 `~/.gstack/.skill-prefix` 文件持久化。

### 10.2.3 依赖检查：Bun 验证

setup 首先验证 Bun 已安装（`bun --version`），缺失时输出包含下载链接和 SHA256 校验的安装指令：

```bash
echo "Installing Bun..." && curl -fsSL https://bun.sh/install | bash
# 同时验证校验和：SHA256: <expected> bun-installer.sh
```

### 10.2.4 Playwright Chromium 安装

`ensure_playwright_browser()` 函数处理浏览器依赖：

- **Bun 环境**（非 Windows）：使用 `bunx playwright install chromium`（绕过 bun#4253 问题）
- **Node.js 环境**（Windows）：使用 `npx playwright install chromium`

Bun#4253 是 Bun 已知 bug：子进程调用 Playwright 时阻塞，workaround 是在 Node.js 下运行。

### 10.2.5 技能目录链接（Claude Code）

`link_claude_skill_dirs()` 函数为每个技能子目录创建顶级目录并软链接其 SKILL.md：

```bash
# 目录结构：
# ~/.claude/skills/gstack-qa/    →  真实目录
# ~/.claude/skills/gstack-qa/SKILL.md  →  软链接 →  $GSTACK/qa/SKILL.md
# ~/.claude/skills/gstack/        →  软链接 →  $GSTACK（仓库根目录）
```

命名策略：`name:` frontmatter 字段 + prefix 模式决定链接名。若技能名已以 `gstack-` 开头则不再添加前缀。

**迁移一**（flat → prefix）：`cleanup_old_claude_symlinks()` 检测 `~/.claude/skills/<name>` 是否指向 gstack/，是则删除。
**迁移二**（prefix → flat）：`cleanup_prefixed_claude_symlinks()` 检测 `~/.claude/skills/gstack-<name>` 是否指向 gstack/，是则删除。

`gstack-patch-names` 脚本批量修改 SKILL.md 中的 `name:` 字段以匹配 prefix/no-prefix 偏好。

`gstack-relink` 自愈脚本在 setup 完成后重新运行，确保 `name:` 字段与目录名一致。

### 10.2.6 Codex 安装

Codex 安装使用生成式方法：

1. `bun run gen:skill-docs --host codex` 生成 `.agents/skills/gstack-*` 格式的技能文档
2. `link_codex_skill_dirs()` 将生成的技能链接到 `$CODEX_SKILLS`
3. `create_codex_runtime_root()` 构建最小化运行时根目录 `~/.codex/skills/gstack/`，仅包含实际运行时代码（bin/、browse/dist/、SKILL.md），避免整个仓库暴露给 Codex 扫描器导致重复技能
4. `create_agents_sidecar()` 在 `.agents/skills/gstack/` 创建 sidecar 目录，链接运行时资产（bin/、browse/、review/ 等）

### 10.2.7 Kiro CLI 安装

Kiro 安装从 `.agents/skills/` 复制并用 `sed` 重写路径：

```bash
sed -e "s|~/.claude/skills/gstack|~/.kiro/skills/gstack|g" \
    -e "s|\.claude/skills/gstack|.kiro/skills/gstack|g" \
    "$SOURCE_GSTACK_DIR/SKILL.md" > "$KIRO_GSTACK/SKILL.md"
```

根 SKILL.md 和每个生成的技能文件中的路径变量均被替换为目标 Host 的对应路径。

### 10.2.8 Factory Droid 安装

与 Codex 安装流程平行，使用 `.factory/skills/` 生成目录：

1. `bun run gen:skill-docs --host factory` 生成 Factory 格式技能文档
2. `create_factory_runtime_root()` 构建最小化运行时根
3. `link_factory_skill_dirs()` 链接到 `$FACTORY_SKILLS`

### 10.2.9 迁移脚本框架

`setup` 末尾运行版本迁移脚本（gstack-upgrade/migrations/v*.sh）：

```bash
# 仅当版本变更时运行
find "$MIGRATIONS_DIR" -maxdepth 1 -name 'v*.sh' -type f | sort -V | while read migration; do
  m_ver="$(basename "$migration" .sh | sed 's/^v//')"
  # 运行：last < m_ver <= current 的迁移
  if [ "$(printf '%s\n%s' "$LAST_SETUP_VERSION" "$m_ver" | sort -V | head -1)" = "$LAST_SETUP_VERSION" ] && \
     [ "$LAST_SETUP_VERSION" != "$m_ver" ] && \
     [ "$(printf '%s\n%s' "$m_ver" "$CURRENT_VERSION" | sort -V | tail -1)" = "$CURRENT_VERSION" ]; then
    bash "$migration"
  fi
done
```

当前版本记录在 `~/.gstack/.last-setup-version`，新版本首次 setup 时跳过迁移（标记文件存在但版本号不同的判断逻辑处理了这种情况）。

---

## 10.3 版本检查：gstack-update-check

### 10.3.1 缓存机制

| 状态 | TTL | 说明 |
|------|-----|------|
| `UP_TO_DATE` | 60 分钟 | 本地已是最新版本 |
| `UPGRADE_AVAILABLE` | 720 分钟（12 小时） | 有可用更新 |

缓存文件：`~/.gstack/last-update-check`，格式为 `<状态> <版本>`。

### 10.3.2 Snooze 机制

用户可推迟更新提醒，支持递进延迟：

- **Level 1**（首次 Snooze）：24 小时
- **Level 2**（第二次 Snooze）：48 小时
- **Level 3+**（后续 Snooze）：168 小时（7 天）

新版本出现时重置 snooze 计数器（用户可能想了解新功能）。

缓存文件：`~/.gstack/update-snoozed`，格式为 `<版本> <层级> <Unix时间戳>`。

### 10.3.3 版本获取

从 GitHub raw 获取最新版本：`https://raw.githubusercontent.com/garrytan/gstack/main/VERSION`

响应必须为有效版本号格式（非 HTML 错误页面、非空），否则静默失败返回空。

### 10.3.4 Codex Description 迁移

一次性迁移：检测 `~/.claude/skills/gstack-*/SKILL.md` 中 `description:` 字段超过 1024 字符的旧 Codex 描述，并删除超长字段（Claude Code 加载时警告，但不影响功能）。

### 10.3.5 遥测

非阻塞后台 ping：`curl -s --max-time 5 https://<supabase>/analytics ... &`

通过 `$HOME/.gstack/telemetry` 配置或 `--no-telemetry` 标志禁用。

---

## 10.4 升级机制：gstack-upgrade

### 10.4.1 四种安装类型

| 类型 | 路径 | 特征 |
|------|------|------|
| `global-git` | `~/.claude/skills/gstack/`（git clone） | `INSTALL_DIR/.git` 存在 |
| `local-git` | `$(pwd)/.claude/skills/`（git clone） | `.git` 存在 + LOCAL_INSTALL=1 |
| `vendored` | `$(pwd)/.claude/skills/gstack/`（直接复制） | `.git` 不存在 |
| `vendored-global` | `~/.claude/skills/gstack/`（直接复制） | `.git` 不存在 |

### 10.4.2 升级命令选项

升级技能提供 5 个选项（AskUserQuestion）：

1. **Yes, upgrade now** — 立即升级
2. **Always keep me up to date** — 设置 `GSTACK_AUTO_UPGRADE=1` 或 `auto_upgrade: true`（未来自动升级，跳过询问）
3. **Not now** — Snooze Level 1（24 小时）
4. **Never ask again** — 设置 `auto_upgrade: never`（彻底关闭提示）
5. **Show changelog first** — 显示变更日志后回到选项 1

### 10.4.3 git 升级流程

对于 global-git / local-git 安装：

```bash
# 1. 暂存本地修改（如果有）
git stash

# 2. 拉取最新代码
git fetch origin
git reset --hard origin/main

# 3. 运行 setup（重新链接、迁移等）
./setup
```

### 10.4.4 vendored 升级流程

对于 vendored 安装（无 .git）：

```bash
# 1. 克隆最新版本到临时目录
git clone --depth 1 https://github.com/garrytan/gstack /tmp/gstack-upgrade

# 2. 备份旧版本
mv "$INSTALL_DIR" "$INSTALL_DIR.bak"

# 3. 移动新版本到目标位置
mv /tmp/gstack-upgrade "$INSTALL_DIR"

# 4. 运行 setup
cd "$INSTALL_DIR" && ./setup

# 5. 删除备份
rm -rf "$INSTALL_DIR.bak"
```

### 10.4.5 本地副本同步

当存在 repo-local vendored 安装（`LOCAL_GSTACK`）时，gstack-upgrade 还会同步更新本地副本：

```bash
# 比较版本号
PRIMARY_VER=$(cat "$INSTALL_DIR/VERSION")
LOCAL_VER=$(cat "$LOCAL_GSTACK/VERSION")
# 若不同步
```

### 10.4.6 Step 4.75：迁移脚本

升级过程中运行 `gstack-upgrade/migrations/v*.sh`，与 setup 中的迁移逻辑平行，但专门处理升级场景（setup 处理安装场景）。

### 10.4.7 独立使用（Standalone）

当直接调用 `/gstack-upgrade`（非 preamble 触发）时：

1. 强制刷新版本检查（`--force`）
2. 比较 primary 和 local vendored 两个版本的 VERSION 文件
3. 告知用户当前状态：有可用更新 / 已是最新 / 本地副本已同步

---

## 10.6 文件清单

### 10.6.1 关键源文件

| 文件 | 用途 |
|------|------|
| `package.json` | 构建脚本定义 |
| `VERSION` | 当前版本号 |
| `setup` | 多 Host 安装脚本 |
| `bin/gstack-update-check` | 版本检查工具 |
| `gstack-upgrade/SKILL.md.tmpl` | 升级技能模板 |
| `browse/scripts/build-node-server.sh` | Playwright node-server 构建 |
| `bin/gstack-patch-names` | 批量修改技能 name 字段 |
| `bin/gstack-relink` | 自愈式重链接脚本 |

### 10.6.2 运行时状态文件

| 路径 | 说明 |
|------|------|
| `~/.gstack/last-update-check` | 版本检查缓存 |
| `~/.gstack/update-snoozed` | Snooze 状态 |
| `~/.gstack/telemetry` | 遥测开关 |
| `~/.gstack/.skill-prefix` | 技能前缀偏好 |
| `~/.gstack/.last-setup-version` | 上次 setup 版本 |
| `~/.gstack/.welcome-seen` | 首次欢迎标记 |

### 10.6.3 迁移脚本目录

| 路径 | 说明 |
|------|------|
| `gstack-upgrade/migrations/` | 版本迁移脚本目录（v*.sh） |
