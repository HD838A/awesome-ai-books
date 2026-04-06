# 第2章：gstack 的整体架构——守护进程与状态管理

上一章我们看到 gstack 把 AI 变成了虚拟工程团队。但这个团队需要一个**共享的大脑和眼睛**——持久化的浏览器进程和可靠的状态管理。

本章我们将揭开 gstack 的架构内幕：为什么选择守护进程模型？为什么选择 Bun？状态文件如何工作？Ref 系统如何让 AI 精准操作页面元素？

---

## 概述

本章我们将深入：

- **守护进程模型**：为什么需要一个长生命周期的浏览器进程
- **Bun 运行时**：编译二进制、原生 SQLite、零配置
- **状态管理**：文件即状态，原子写入，版本自动重启
- **安全模型**：localhost only + Bearer token + Cookie 安全
- **Ref 系统**：让 AI 用 @e1 而不是 CSS selector 操作元素
- **日志架构**：O(1) 环形缓冲区，有界内存

读完本章，你会理解 gstack 的每个架构决策背后的权衡。

---

## 2.1 守护进程模型：为什么需要持久化浏览器？

### 传统方案的困境

大多数 AI 编程工具遇到浏览器时，采用的是"按需启动"模式：

```typescript
// 每次命令都这样
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://example.com');
// ... 操作 ...
await browser.close();
```

**问题一：启动延迟**

Playwright 启动 Chromium 需要 ~2-3 秒。如果一次 QA 会话有 20 个命令，这就是 40-60 秒的纯启动开销。

**问题二：状态丢失**

| 状态类型 | 按需启动 | 守护进程 |
|----------|----------|----------|
| 登录 Cookie | 每次丢失 | 持久化 |
| 打开的标签页 | 每次丢失 | 保持打开 |
| localStorage | 每次丢失 | 持久化 |
| 用户会话 | 每次丢失 | 持久化 |

想象你正在测试一个需要 MFA 认证的页面。每次命令都要重新登录验证码，你还愿意用这个工具吗？

### 守护进程模型的优势

```
┌─────────────────────────────────────────────────────────────┐
│                     gstack 架构                             │
├─────────────────────────────────────────────────────────────┤
│  Claude Code                                                │
│  ──────────                      gstack                     │
│                             ┌──────────────────────┐        │
│  Tool call: $B snapshot -i  │  CLI (compiled binary)│        │
│  ─────────────────────────→ │  • reads state file   │        │
│                             │  • POST /command      │        │
│                             └──────────┬───────────┘        │
│                                        │ HTTP               │
│                             ┌──────────▼───────────┐        │
│                             │  Server (Bun.serve)   │        │
│                             │  • dispatches command │        │
│                             │  • talks to Chromium  │        │
│                             └──────────┬───────────┘        │
│                                        │ CDP                 │
│                             ┌──────────▼───────────┐        │
│                             │  Chromium (headless)  │        │
│                             │  • persistent tabs    │        │
│                             │  • cookies carry over │        │
│                             └──────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

**关键指标：**
- 首次调用启动时间：~3秒
- 后续每次调用：**~100-200ms**

**性能差距：20 倍。**

### 守护进程生命周期

```
1. CLI 首次调用
   ↓
2. 检查 ~/.gstack/browse.json
   ↓ (文件不存在)
3. 启动服务器（随机端口 10000-60000）
   ↓
4. 写入状态文件（PID、端口、token、版本）
   ↓
5. HTTP 请求循环
   ↓
6. 30 分钟空闲
   ↓
7. 服务器自动关闭
```

**用户体验：** 零配置，零进程管理。首次使用自动启动，空闲自动关闭。

---

## 2.2 为什么选择 Bun？

### 不是 Node.js 不好，而是 Bun 更适合

| 维度 | Node.js | Bun | gstack 为什么需要 |
|------|---------|-----|------------------|
| 运行时 | V8 | JavaScriptCore | 无所谓 |
| 包管理器 | npm | 内置 | 无所谓 |
| **编译二进制** | 需 pkg/nexe | `bun build --compile` | **必须** |
| **原生 SQLite** | 需 better-sqlite3 | 内置 | **必须** |
| **原生 TypeScript** | 需 ts-node | `bun run` | 方便 |
| **内置 HTTP** | 需 Express | `Bun.serve()` | 够用 |

### 编译成二进制：零配置运行

gstack 安装到 `~/.claude/skills/`——这是用户不希望管理 Node.js 项目的目录。

```bash
# Node.js 方式
~/.claude/skills/gstack/
├── package.json
├── node_modules/
│   ├── playwright/
│   └── better-sqlite3/
├── bun.lockb
└── tsconfig.json

# Bun 方式
~/.claude/skills/gstack/
└── gstack  ← 单文件可执行，~58MB
```

用户双击就能运行，不需要安装 Node.js，不需要跑 `npm install`。

### 原生 SQLite：Cookie 导入的关键

gstack 的 Cookie 导入功能需要读取 Chromium 的 SQLite 数据库：

```typescript
// Bun 方式（原生支持）
const db = new Database('/path/to/cookies');
const cookies = db.query('SELECT * FROM cookies').all();

// Node.js 方式
const Database = require('better-sqlite3'); // 需要编译 native addon
```

Native addon 在不同机器上可能编译失败。**Bun 的内置支持消除了这个风险。**

### 性能数据

| 操作 | Node.js | Bun |
|------|---------|-----|
| 二进制启动 | ~100ms | ~1ms |
| HTTP 服务器吞吐量 | 基准 | 更快 |
| SQLite 查询 | 需要插件 | 内置 |

瓶颈永远是 Chromium，不是 CLI 或服务器。Bun 的 ~1ms 启动是锦上添花，真正的价值是编译二进制和原生 SQLite。

---

## 2.3 状态管理：文件即状态

### 状态文件结构

`.gstack/browse.json` 存储会话信息：

```json
{
  "pid": 12345,
  "port": 34567,
  "token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "startedAt": "2024-01-15T10:30:00.000Z",
  "binaryVersion": "v2.3.1-abc1234"
}
```

### 原子写入：防止读取不完整状态

```typescript
// 写入流程
const tmpPath = '.gstack/.browse.json.tmp';
const finalPath = '.gstack/browse.json';

// 1. 写入临时文件
await writeFile(tmpPath, JSON.stringify(state));

// 2. 原子重命名
fs.renameSync(tmpPath, finalPath);

// 3. 设置权限（仅所有者可读写）
fs.chmodSync(finalPath, 0o600);
```

**为什么需要原子写入？** 如果写入过程中另一个进程读取文件，可能得到不完整的状态。原子重命名保证要么全部成功，要么全部失败。

### 端口选择：支持多工作区

```typescript
const MIN_PORT = 10000;
const MAX_PORT = 60000;
const RETRY_COUNT = 5;

// 随机选择，避免端口冲突
const port = MIN_PORT + Math.floor(Math.random() * (MAX_PORT - MIN_PORT));
```

**结果：** 10 个 Claude Code 工作区可以同时运行，各自独立，零配置。

### 版本自动重启：消灭过时二进制 bug

```typescript
// 构建时：写入版本信息
// $ git rev-parse HEAD > browse/dist/.version

// 运行时：检查版本
const runningVersion = readVersionFromServer();
const binaryVersion = readVersionFromFile();

if (runningVersion !== binaryVersion) {
  // 版本不匹配：杀死旧服务器，启动新服务器
  kill(runningPid);
  spawnNewServer();
}
```

**解决的问题：** 开发者重新构建二进制后，下次命令自动使用新版本。不会出现"我明明更新了，但工具还在用旧版本"的困惑。

---

## 2.4 安全模型：三层防护

### localhost only：不暴露到网络

```typescript
// 服务器绑定 localhost，不是 0.0.0.0
Bun.serve({
  hostname: 'localhost',  // ← 只监听本机
  port: 34567,
  // ...
});
```

即使服务器有漏洞，也无法被远程利用。

### Bearer Token：防止同机器其他进程访问

```
1. 服务器启动 → 生成随机 UUID token
2. 写入 .gstack/browse.json（mode 0o600）
3. 每个 HTTP 请求必须包含：
   Authorization: Bearer a1b2c3d4-e5f6-7890-abcd-ef1234567890
4. 不匹配 → 返回 401 Unauthorized
```

**例外：** `/health` 和 Cookie picker UI 无需 token——它们是 localhost only 且不执行命令。

### Cookie 安全：处理最敏感的数据

| 安全措施 | 说明 |
|----------|------|
| Keychain 需用户批准 | macOS 对话框首次导入时弹出，用户必须点击"允许" |
| 内存解密 | Cookie 值在进程中解密，加载到 Playwright，从不写磁盘 |
| 数据库只读 | 复制到临时文件打开，避免锁定真实浏览器数据 |
| Key 仅会话缓存 | 服务器关闭时所有密钥清空 |
| 日志不含 Cookie | console/network/dialog 从不记录 Cookie 值 |

---

## 2.5 Ref 系统：让 AI 操作元素的艺术

### 传统方式的问题

```typescript
// AI 需要记住这个脆弱的选择器
await page.click('button[data-testid="submit-form-123"]');

// 问题：页面重构后选择器失效
// 问题：AI 不知道页面上有什么元素
// 问题：选择器不语义化，难以理解意图
```

### Ref 系统工作原理

**第一步：获取页面元素**

```
Agent:  $B snapshot -i

Server:
1. 调用 Playwright page.accessibility.snapshot()
2. 遍历 ARIA 树，分配序号 @e1, @e2, @e3...
3. 为每个 ref 构建 Playwright Locator
4. 返回带标注的纯文本树

返回示例：
@e1 [button] "Submit Form"
@e2 [textbox] "Email address"
@e3 [link] "Forgot password?"
```

**第二步：使用元素**

```
Agent:  $B click @e1

Server:
1. 解析 @e1 → Locator
2. 执行 locator.click()
3. 返回结果
```

### 为什么用 Locator 而不是 DOM 注入？

| 方案 | DOM 注入 | Locator（gstack） |
|------|----------|-------------------|
| CSP 阻止 | ❌ 很多站点阻止 DOM 修改 | ✅ 外部查询，无 DOM 改动 |
| 框架冲突 | ❌ React/Vue 可能剥离属性 | ✅ 无框架冲突 |
| Shadow DOM | ❌ 无法穿透 shadow root | ✅ 可以处理 |

```typescript
// DOM 注入方式（会失败）
await page.evaluate(() => {
  element.dataset.ref = 'e1';  // 可能被 CSP 阻止
});

// Locator 方式（正确）
const locator = page.getByRole('button', { name: 'Submit Form' });
await locator.click();  // 使用 ARIA 树查询
```

### Ref 生命周期管理

**清除时机：** 主框架 navigation（URL 改变）

```typescript
// 页面导航时清除所有 refs
browser.on('framenavigated', () => {
  refMap.clear();
});
```

**为什么？** navigation 后所有 locators 都失效了。让它们大声失败比悄悄点击错误元素好。

### 失效检测：防止陈旧引用

SPAs（单页应用）可能在不触发 navigation 的情况下改变页面内容：

- React Router 切换
- Tab 切换
- Modal 打开/关闭

```typescript
async function resolveRef(ref: string): Promise<Locator> {
  const entry = refMap.get(ref);
  const count = await entry.locator.count();

  if (count === 0) {
    throw new Error(
      `Ref @${ref} is stale — element no longer exists. ` +
      `Run 'snapshot' to get fresh refs.`
    );
  }

  return entry.locator;
}
```

**性能：** count() 检查只需 ~5ms，而不是等待 30 秒超时。

### Cursor-interactive refs (@c)

有些可点击元素不在 ARIA 树中：

- 用 `cursor: pointer` 样式化的元素
- 有 `onclick` 属性的元素
- 自定义 `tabindex` 组件

```bash
# 找到 ARIA 树内元素 + 树外可点击元素
$B snapshot -C

返回：
@e1 [button] "Submit Form"
@e2 [textbox] "Email"
@c1 [div] "Custom dropdown trigger"  ← cursor-interactive
@c2 [span] "Click me"               ← cursor-interactive
```

---

## 2.6 日志架构：O(1) 环形缓冲区

### 三个独立缓冲区

```
控制台消息 ──→ CircularBuffer #1 (50,000 条)
网络请求  ──→ CircularBuffer #2 (50,000 条)
对话框事件 ──→ CircularBuffer #3 (50,000 条)
```

### 环形缓冲区特性

| 特性 | 说明 |
|------|------|
| O(1) 插入 | 无论缓冲区多满，插入时间恒定 |
| 有界内存 | 50K × 3 = 150K 条目上限，不会无限增长 |
| 自动覆盖 | 写满后从头覆盖，不丢数据（除非关注的是被覆盖的旧数据） |

### 异步刷新：从不阻塞请求

```typescript
// 每秒刷新一次
setInterval(() => {
  flushToDisk(buffer, '.gstack/console.log');
  flushToDisk(buffer, '.gstack/network.log');
  flushToDisk(buffer, '.gstack/dialog.log');
}, 1000);

// HTTP 请求处理函数从不等待磁盘 I/O
async function handleCommand(req) {
  buffer.push(logEntry);  // 只写内存，毫秒级
  return executeCommand();
}
```

**结果：**
- 请求处理不被磁盘 I/O 阻塞
- 服务器崩溃最多丢失 1 秒数据
- 磁盘文件追加写入，可被外部工具读取

### 命令读取路径

```bash
# console/network/dialog 命令从内存读取
$B console   → 读取内存缓冲区 → 返回最新日志
$B network  → 读取内存缓冲区 → 返回网络请求
```

磁盘文件用于事后调试，实时交互用内存。

---

## 2.7 SKILL.md 模板系统：文档与代码同步

### 问题：文档与代码漂移

手工维护 SKILL.md 时常遇到：

```
1. 开发者添加了新命令
2. 忘了更新文档
3. Agent 执行时遇到未知命令
4. 用户困惑：文档说有这个功能，为什么报错？
```

### 解决方案：模板 + 自动生成

```
SKILL.md.tmpl          （人工编写的工作流 + 提示）
       ↓
gen-skill-docs.ts      （读取源码元数据）
       ↓
SKILL.md               （提交版本，含自动生成部分）
```

### 占位符系统

| 占位符 | 生成内容 |
|--------|----------|
| `{{COMMAND_REFERENCE}}` | 按类别分类的命令表（从 commands.ts） |
| `{{SNAPSHOT_FLAGS}}` | 标志参考 + 示例（从 snapshot.ts） |
| `{{PREAMBLE}}` | 更新检查、会话追踪、ELI16 模式 |
| `{{BROWSE_SETUP}}` | 二进制发现 + 安装说明 |
| `{{QA_METHODOLOGY}}` | /qa 和 /qa-only 共享 QA 方法论 |

### 构建时验证

```bash
# CI 检查：生成结果是否与源码同步
bun run gen:skill-docs --dry-run
git diff --exit-code  # 有变更则失败
```

### 为什么提交生成结果？

1. **Claude 读取时机**：SKILL.md 在技能加载时读取，无构建步骤
2. **CI 可验证**：`git diff` 捕获未同步的文档
3. **Git blame 可追溯**：可看到命令添加时间和提交

---

## 2.8 命令调度：读写分离

### 三类命令

| 类别 | 特点 | 命令示例 |
|------|------|----------|
| **READ** | 无变更，可安全重试 | text, html, links, console, cookies |
| **WRITE** | 变更页面状态，非幂等 | goto, click, fill, press |
| **META** | 服务器级操作 | snapshot, screenshot, tabs, chain |

### 调度实现

```typescript
if (READ_COMMANDS.has(cmd)) {
  return handleReadCommand(cmd, args, browserManager);
}

if (WRITE_COMMANDS.has(cmd)) {
  return handleWriteCommand(cmd, args, browserManager);
}

if (META_COMMANDS.has(cmd)) {
  return handleMetaCommand(cmd, args, browserManager, shutdown);
}
```

**分类的价值：** READ 命令可以幂等重试，WRITE 命令需要警告用户重试后果。

---

## 2.9 错误哲学：错误为 AI 而设计

### 传统错误 vs gstack 错误

| 传统错误 | gstack 改进 |
|----------|-------------|
| "Element not found" | "Element not found or not interactable. Run `snapshot -i` to see available elements." |
| "Timeout" | "Navigation timed out after 30s. The page may be slow or the URL may be wrong." |
| "No cookie found" | "No cookie found for 'session_id'. Run `setup-browser-cookies` to import cookies from your browser." |

**原则：** 每个错误都告诉 AI **下一步该做什么**。

### 崩溃恢复：不尝试自我修复

```typescript
// Chromium 崩溃时
browser.on('disconnected', () => {
  server.exit(1);  // 直接退出，不尝试重连
});

// CLI 检测到服务器死亡
if (!await healthCheck()) {
  spawnNewServer();  // 启动新服务器
}
```

**设计理念：** 比尝试重新连接半死进程更简单可靠的是直接重启。

---

## 本章小结

1. **守护进程模型**：持久化浏览器 = 亚秒级响应 + 状态保持
2. **Bun 运行时**：编译二进制 + 原生 SQLite + 零配置
3. **状态文件**：原子写入 + 版本自动重启
4. **安全模型**：localhost only + Bearer token + Cookie 安全
5. **Ref 系统**：用 @e1 操作元素，基于 ARIA 树，Locator 查询
6. **日志架构**：O(1) 环形缓冲区 + 异步刷新 + 有界内存
7. **SKILL.md 模板**：源码驱动文档，永不过时
8. **错误哲学**：可操作的错误消息，不尝试自我修复

---

## 预告

第3章我们将深入 **browse 核心实现**：CLI 如何启动服务器？CDP 协议如何封装？Cookie 导入如何工作？sidebar agent 是如何实现的？

<!-- DRAFT_COMPLETE -->
