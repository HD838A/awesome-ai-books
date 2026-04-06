# 第9章：安全机制——freeze / guard / careful

gstack 的设计哲学是让 AI 代理成为一个高效的工程助手，但这意味着 AI 有能力修改文件、执行命令。在真实的工作环境中，这种能力需要护栏。

gstack 内置了三层安全机制，分别针对不同类型的风险：

- **/freeze**：防止 AI 意外修改冰封范围之外的文件
- **/careful**：在执行危险命令前强制用户确认
- **/guard**：前两者的组合，提供最大安全覆盖

这三个技能都基于 Claude Code 的 **PreToolUse Hook API**——在工具执行前拦截、检查、决策。这是一种介于沙箱（sandbox）和信任（trust）之间的务实方案。

---

## 9.1 PreToolUse Hook 机制

### Hook API 的工作原理

Claude Code 的 Skill Hooks 是 SKILL.md frontmatter 中的声明式配置：

```yaml
hooks:
  PreToolUse:
    - matcher: "Edit"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/bin/check-freeze.sh"
          statusMessage: "Checking freeze boundary..."
```

当 AI 代理调用"Edit"工具时，Claude Code 会：

1. 将工具调用的 JSON 传给 `check-freeze.sh`（通过 stdin）
2. 脚本返回 permissionDecision（允许/拒绝/询问）
3. Claude Code 根据返回值决定：放行、阻断、或暂停询问用户

### permissionDecision 的三种语义

| 返回值 | 含义 | 用户体验 |
|--------|------|---------|
| `{}`（空对象） | allow（隐式） | 工具正常执行 |
| `{"permissionDecision":"deny","message":"..."}` | deny（显式阻断） | 工具被拦截，错误信息显示给用户 |
| `{"permissionDecision":"ask","message":"..."}` | ask（询问确认） | 工具暂停，用户决定是否继续 |

/freeze 使用 deny（越界编辑总是不期望的），/careful 使用 ask（危险命令有时是合法的）。

---

## 9.2 /freeze：目录编辑边界

### 使用场景

/freeze 适用于以下场景：
- 调试时：只想改一个文件，防止 AI 顺手修复"无关的"代码
- 重构时：只想改一个模块，防止 AI 大规模修改
- Code Review 时：只想查看代码，防止任何修改

### 激活流程

用户运行 `/freeze` 后，技能通过 AskUserQuestion 获取目标目录：

```
Q: "Which directory should I restrict edits to?"
A: ./src/api/
```

技能将路径解析为绝对路径并规范化，存入状态文件：

```bash
FREEZE_DIR="/Users/yaya/project/src/api/"
echo "$FREEZE_DIR" > "$HOME/.gstack/freeze-dir.txt"
```

### Hook 脚本的执行流程

`check-freeze.sh` 对每个 Edit/Write 调用执行 5 层检查：

```
工具调用 JSON → stdin
    │
    ▼
[1] 状态文件存在？不存在 → 允许（未配置）
    │
    ▼
[2] 冻结目录非空？空 → 允许
    │
    ▼
[3] 提取 file_path
    │  grep/sed 优先（99% 情况）
    │  └─ 失败 → Python fallback（处理转义引号）
    │
    ▼
[4] 路径规范化
    │  相对路径 → 绝对路径
    │  去除双斜杠、尾部斜杠
    │  解析 symlink 和 ..（POSIX 兼容 macOS）
    │
    ▼
[5] 边界匹配
    │  FILE_PATH startsWith FREEZE_DIR/ → 允许
    │  否则 → deny
```

### 路径规范化的 POSIX 实现

freeze.sh 不使用 `readlink -f`（macOS 不支持），而是手写 shell 函数：

```bash
_resolve_path() {
  local _dir _base
  _dir="$(dirname "$1")"
  _base="$(basename "$1")"
  _dir="$(cd "$_dir" 2>/dev/null && pwd -P || printf '%s' "$_dir")"
  printf '%s/%s' "$_dir" "$_base"
}
```

这确保了跨平台一致性——无论在 macOS、Linux 还是 CI 环境中，路径解析结果相同。

### 安全边界与局限

**生效范围**：只限制 Edit 和 Write 工具。

**可绕过的路径**：`sed`、`awk`、`tee`、`printf > file` 等 Bash 命令可以直接写文件，不受 /freeze 约束。这是设计上的诚实——gstack 选择轻量的 Hook 而非重量级的沙箱。

**尾部斜杠防前缀混淆**：`/src/` 不匹配 `/src-old/`，因为规范化后的路径是 `/Users/yaya/project/src/` 和 `/Users/yaya/project/src-old/`，前缀不同。

**Symlink 解析**：使用 `pwd -P`（POSIX 规范）解析符号链接的最终目标，使通过 symlink 绕过边界的尝试无效。

---

## 9.3 /careful：危险命令警告

### 使用场景

/careful 适用于：
- 接触生产环境时：任何 rm、git reset、kubectl delete 都应确认
- 共享环境：防止团队成员（或其他 AI 代理）执行毁灭性操作
- 调试时：需要频繁删除构建产物，但担心误删源码

### 8 类危险模式

表 9-1 列出了 /careful 检测的所有危险命令模式。

**表 9-1：/careful 危险命令检测表**

| 模式 | 示例命令 | 风险等级 | 警告信息 |
|------|---------|---------|---------|
| 递归删除 | `rm -rf /var/data` | 极高 | 递归删除，永久删除文件 |
| DROP 对象 | `DROP TABLE users;` | 极高 | SQL DROP，永久删除数据库对象 |
| TRUNCATE | `TRUNCATE orders;` | 高 | TRUNCATE，删除表中所有行 |
| git force-push | `git push -f origin main` | 高 | force-push 重写远程历史 |
| git reset hard | `git reset --hard HEAD~3` | 高 | 丢弃所有未提交更改 |
| git discard | `git checkout .` | 中 | 丢弃工作区所有未提交更改 |
| kubectl delete | `kubectl delete pod api` | 极高 | Kubernetes 资源删除，可能影响生产 |
| docker destructive | `docker system prune -a` | 高 | 清理容器/镜像，可能删除运行中容器 |

### 安全例外

以下 rm -rf 目标被列入安全例外，不触发警告：

```
node_modules/  .next/  dist/  __pycache__/  .cache/
build/  .turbo/  coverage/
```

这些是标准构建产物清理操作，每次 `npm install`、`./setup` 都会重新生成，不应干扰正常工作流。

### Hook 执行流程

```
Bash 工具调用 JSON → stdin
    │
    ▼
[1] 提取 command 字段（grep/sed → Python fallback）
    │
    ▼
[2] 安全例外检查
    │  rm -rf node_modules/ → 允许
    │
    ▼
[3] 8 类危险模式逐项匹配（短路求值）
    │  发现第一个匹配 → 设置 WARN 和 PATTERN
    │
    ▼
[4] 返回
    │  有 WARN → ask + 遥测记录
    │  无 WARN → 允许
```

### 遥测记录

/careful 触发时，记录 hook_fire 事件到 `~/.gstack/analytics/skill-usage.jsonl`：

```json
{"event":"hook_fire","skill":"careful","pattern":"rm_recursive","ts":"2026-04-06T10:31:00Z","repo":"my-project"}
```

注意：**命令内容不被记录**——只记录触发的危险类型（rm_recursive、git_force_push 等），保护用户代码隐私。

---

## 9.4 /guard：完整防护组合

### guard 的双重 Hook

/guard 不是一个独立的检查器，而是同时注册了来自 /careful 和 /freeze 的三个 Hook：

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/../careful/bin/check-careful.sh"
    - matcher: "Edit"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/../freeze/bin/check-freeze.sh"
    - matcher: "Write"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/../freeze/bin/check-freeze.sh"
```

guard 与 careful 和 freeze 是同级目录，所以路径使用 `../`。

### /guard 的防护效果

用户运行 `/guard` 并指定目录后，同时获得：

- **Edit/Write 边界阻断**：超出目录的编辑被拒绝
- **危险命令询问**：Bash 中的毁灭性命令暂停确认

```
【Claude Code】
Guard mode active. Two protections are now running:
1. Destructive command warnings — rm -rf, DROP TABLE, force-push 等将在执行前警告
2. Edit boundary — 文件编辑限制在 src/ 目录下，超出目录的编辑将被阻断
```

### DRY 原则的体现

/guard 不复制 /careful 和 /freeze 的检查逻辑，而是通过引用它们的 Hook 脚本路径来组合功能。如果需要修改危险命令的检测逻辑，只需更新 `check-careful.sh` 一处，/guard 自动继承。

---

## 9.5 设计与安全哲学

### 护栏 vs 沙箱

gstack 的安全机制是**护栏**而非**沙箱**。护栏是：

- 轻量：纯 Bash 脚本，无进程隔离
- 可穿透：Bash 命令可以绕过 Edit/Write 限制
- 诚实：不假装比实际更安全

沙箱是：

- 重量级：容器化或虚拟机隔离
- 不可穿透：即使 Bash 命令也无法绕过
- 过度承诺：容易产生虚假安全感

gstack 选择护栏是因为：沙箱在 AI 编程场景中不可行（AI 需要读取文件系统才能工作），而护栏在大多数情况下足够有效。

### 状态文件持久化

freeze-dir.txt 存储在 `$HOME/.gstack/` 或 `$CLAUDE_PLUGIN_DATA` 环境变量指定的位置。这支持企业场景中通过 `CLAUDE_PLUGIN_DATA` 将状态文件放在合规存储中。

### Hook 触发的遥测价值

两个 Hook 都记录触发事件到 skill-usage.jsonl，这提供了：

- 安全事件频率监控
- 误触发模式分析
- 团队安全培训效果评估

同时，不记录命令内容或文件路径，确保遥测不成为数据泄露的渠道。

---

## 9.6 本章小结

gstack 的三层安全机制展示了"分层防御"（defense in depth）思想：

**第一层：目录边界（/freeze）**：用 deny 策略阻断越界编辑，基于路径前缀匹配和 symlink 解析。

**第二层：命令警告（/careful）**：用 ask 策略在危险命令执行前暂停，基于 8 类危险模式的正则匹配。

**第三层：完整防护（/guard）**：组合前两层，提供最大覆盖。

核心设计决策：
- Hook API 而非沙箱：务实、轻量、可穿透
- 状态文件持久化：会话间保持安全状态
- 遥测记录但保护隐私：记录模式类型，不记录命令内容
- DRY 组合：/guard 引用而非复制检查逻辑
