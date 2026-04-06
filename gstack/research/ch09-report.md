# ch09 研究报告：安全机制

## 概览

**主题**：gstack 的三层安全机制——/freeze（编辑边界）、/careful（危险命令警告）、/guard（完整防护）

**数据来源**：
- `freeze/SKILL.md.tmpl`、`freeze/SKILL.md`：编辑边界技能
- `freeze/bin/check-freeze.sh`：边界检查 Hook 脚本
- `careful/SKILL.md.tmpl`、`careful/SKILL.md`：危险命令警告技能
- `careful/bin/check-careful.sh`：命令检查 Hook 脚本
- `guard/SKILL.md.tmpl`、`guard/SKILL.md`：完整防护技能

---

## 9.1 三层安全架构

### 防御纵深设计

gstack 的安全机制是分层的，三种模式对应不同的防御强度：

| 模式 | 技能 | 防御范围 | 干预方式 |
|------|------|---------|---------|
| /freeze | 目录编辑边界 | Edit/Write 工具 | deny（阻断） |
| /careful | 危险命令警告 | Bash 工具 | ask（询问） |
| /guard | 完整防护 | Bash + Edit + Write | deny + ask |

### 设计哲学

**不是沙箱，是护栏**：gstack 的安全机制不依赖进程隔离或容器化，而是通过 PreToolUse Hook 拦截工具调用，在执行前检查并决策。这比沙箱更轻量，但也更诚实——Bash 命令（如 `sed`、`awk`）仍然可以绕过 Edit/Write 边界。

**ask vs deny 的区别**：/freeze 用 deny，因为越界编辑几乎总是失误；/careful 用 ask，因为危险命令有时是合法的（清理 node_modules、DROP 测试表）。

---

## 9.2 /freeze：目录编辑边界

### Hook 配置

freeze/SKILL.md.tmpl 的 frontmatter 中声明了两个 PreToolUse Hook：

```yaml
hooks:
  PreToolUse:
    - matcher: "Edit"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/bin/check-freeze.sh"
          statusMessage: "Checking freeze boundary..."
    - matcher: "Write"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/bin/check-freeze.sh"
          statusMessage: "Checking freeze boundary..."
```

Claude Code 的 Skill Hooks API 会将工具调用的 JSON 传递给 Hook 脚本，脚本返回 permissionDecision 决定是否放行。

### 状态文件机制

freeze-dir.txt 存储冻结目录路径：

```
~/.gstack/freeze-dir.txt
```

用户通过 /freeze 激活时设置，AskUserQuestion 获取路径，写入状态文件。Hook 脚本在每次 Edit/Write 调用时读取。

### check-freeze.sh 的 5 层检查

1. **状态文件存在性**：不存在则返回 `{}`（允许一切）
2. **冻结目录非空**：空则返回 `{}`
3. **file_path 提取**：先 grep/sed 提取 `"file_path"` JSON 字段，失败则 Python fallback
4. **路径规范化**：相对路径 → 绝对路径；去除双斜杠和尾部斜杠；解析 symlink 和 `..`（POSIX 兼容 macOS）
5. **边界匹配**：`${FILE_PATH} startsWith ${FREEZE_DIR}/` → 允许，否则 deny

### 返回值语义

```bash
# 允许
echo '{}'
# → permissionDecision: "allow"（隐式）

# 阻断
printf '{"permissionDecision":"deny","message":"[freeze] Blocked: %s is outside..."}\n' "$FILE_PATH" "$FREEZE_DIR"
# → permissionDecision: "deny"（显式）
```

### 安全注意事项

- 冻结只作用于 Edit/Write 工具，不影响 Bash（`sed`、`awk` 可绕过）
- 尾部斜杠防止路径前缀混淆（`/src` 不匹配 `/src-old`）
- 解析 symlink 使硬链接等手法也无法绕过
- 每次调用都重新读取状态文件（无需重启）

---

## 9.3 /careful：危险命令警告

### Hook 配置

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/bin/check-careful.sh"
          statusMessage: "Checking for destructive commands..."
```

### 8 类危险模式

| 模式 | 检测正则 | 警告信息 |
|------|---------|---------|
| rm -rf / rm -r | `rm\s+(-[a-zA-Z]*r\|--recursive)` | 递归删除永久删除文件 |
| DROP TABLE/DATABASE | `drop\s+(table\|database)` | SQL DROP 永久删除数据库对象 |
| TRUNCATE | `\btruncate\b` | TRUNCATE 删除表中所有行 |
| git push -f / --force | `git\s+push\s+.*(-f\b\|--force)` | force-push 重写远程历史 |
| git reset --hard | `git\s+reset\s+--hard` | 丢弃所有未提交更改 |
| git checkout . / restore . | `git\s+(checkout\|restore)\s+\.` | 丢弃工作区所有未提交更改 |
| kubectl delete | `kubectl\s+delete` | 删除 Kubernetes 资源，可能影响生产 |
| docker rm -f / system prune | `docker\s+(rm\s+-f\|system\s+prune)` | 强制删除容器或清理镜像 |

### 安全例外

`rm -rf` 针对以下目录时不触发警告：

```
node_modules, .next, dist, __pycache__, .cache, build, .turbo, coverage
```

这些是常见的构建产物清理操作，不应干扰正常工作流。

### 返回值语义

```bash
# 无危险 → 允许
echo '{}'

# 有危险 → 询问
printf '{"permissionDecision":"ask","message":"[careful] %s"}\n' "$WARN"
# → permissionDecision: "ask"
# Claude Code 会暂停执行，询问用户确认或取消
```

### 命令提取的 grep/Python 双策略

与 freeze.sh 相同的设计：先 grep/sed 提取 JSON 字段（处理 99% 情况），失败则 Python fallback 处理转义引号。这比直接用 Python 更高效，也更符合 Unix 哲学。

---

## 9.4 /guard：完整防护

### 双重 Hook 配置

guard 的 SKILL.md.tmpl 同时注册了三个 PreToolUse Hook：

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/../careful/bin/check-careful.sh"
          statusMessage: "Checking for destructive commands..."
    - matcher: "Edit"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/../freeze/bin/check-freeze.sh"
          statusMessage: "Checking freeze boundary..."
    - matcher: "Write"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/../freeze/bin/check-freeze.sh"
          statusMessage: "Checking freeze boundary..."
```

注意：guard 的 Hook 路径是 `../careful/bin/check-careful.sh` 和 `../freeze/bin/check-freeze.sh`——因为 guard 与 careful 和 freeze 是同级目录。

### 依赖关系

/guard 依赖 /careful 和 /freeze 的 Hook 脚本存在。这不是代码依赖，而是文件路径依赖。gstack 安装脚本确保三者一起安装。

---

## 9.5 Hook 触发遥测

两个 Hook 脚本都在触发时记录事件到 `~/.gstack/analytics/skill-usage.jsonl`：

```json
{"event":"hook_fire","skill":"freeze","pattern":"boundary_deny","ts":"2026-04-06T10:30:00Z","repo":"my-project"}
{"event":"hook_fire","skill":"careful","pattern":"rm_recursive","ts":"2026-04-06T10:31:00Z","repo":"my-project"}
```

记录了：
- event：事件类型（hook_fire）
- skill：触发技能（freeze/careful）
- pattern：匹配模式（boundary_deny / rm_recursive / git_force_push 等）
- ts：时间戳
- repo：仓库名（basename）

**不记录命令内容或文件路径**——这保护了用户代码的隐私，同时仍能提供安全事件的使用统计。

---

## 关键发现

1. **permissionDecision 的三种值**：Claude Code 的 Hook API 支持 "allow"（隐式）、"deny"（显式阻断）、"ask"（暂停询问用户）。freeze 用 deny（越界编辑总是不期望的），careful 用 ask（危险命令有时合法）。

2. **双引擎 JSON 解析**：两个 Hook 脚本都用 grep/sed 优先提取 JSON 字段（高效），失败则 Python fallback（正确处理转义）。这是性能与正确性的平衡。

3. **路径规范化的 POSIX 兼容性**：freeze.sh 用 shell 函数实现 symlink 解析，不依赖 `readlink -f`（macOS 上不存在），确保跨平台一致。

4. **状态文件持久化**：freeze 的状态存储在 `~/.gstack/freeze-dir.txt`，通过 `$HOME/.gstack` 或 `$CLAUDE_PLUGIN_DATA` 环境变量定位，支持 gstack 自定义数据目录。

5. **guard 是组合而非重复**：guard 不是复制 careful 和 freeze 的逻辑，而是引用它们的 Hook 脚本路径，保持代码 DRY。
