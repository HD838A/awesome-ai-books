# 第3章：持久化浏览器核心实现——browse 模块架构

第2章我们了解了 gstack 的整体架构。本章我们将深入 **browse 模块** 的核心实现：CLI 如何工作、服务器如何调度命令、浏览器如何管理、Ref 系统如何让 AI 操作页面元素。

---

## 概述

本章我们将探索：

- **CLI 入口**：瘦包装器如何启动和管理服务器
- **HTTP 服务器**：Bun.serve 的路由和命令调度
- **浏览器管理器**：Chromium 生命周期、页面/标签页管理
- **Ref 系统**：ARIA 树解析和 Locator 构建
- **环形缓冲区**：O(1) 日志存储的实现

读完本章，你会理解 `$B` 命令的完整执行路径。

---

## 3.1 CLI 入口：瘦包装器设计

### CLI 的职责

CLI 不是真正的浏览器控制中心。它是一个**瘦包装器**：

```typescript
// cli.ts — 核心职责
async function main() {
  // 1. 读取状态文件
  const state = readState();

  // 2. 检查服务器是否存活
  if (!await isServerHealthy(state.port)) {
    await killServer(state.pid);
    await spawnServer();
  }

  // 3. 发送命令
  const result = await fetchCommand(cmd, args, state);

  // 4. 打印结果
  console.log(result);
}
```

### 状态文件读取

```typescript
interface ServerState {
  pid: number;        // 服务器进程 ID
  port: number;        // 监听端口
  token: string;       // Bearer token
  startedAt: string;   // 启动时间
  binaryVersion: string; // 二进制版本
}

function readState(): ServerState | null {
  try {
    const data = fs.readFileSync('.gstack/browse.json', 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;  // 文件不存在或解析失败
  }
}
```

### 服务器健康检查

```typescript
async function isServerHealthy(port: number): Promise<boolean> {
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!resp.ok) return false;
    const health = await resp.json();
    return health.status === 'healthy';
  } catch {
    return false;
  }
}
```

**为什么用 HTTP 健康检查而不是进程 ID 检查？**
- HTTP 检查是**确定性证明**：服务器不仅活着，还在响应
- 进程 ID 在 Windows 上不可靠（Bun 编译二进制无法发送信号）

### 启动流程

```
CLI 首次调用: $B goto https://example.com
    │
    ├─→ 读取 .gstack/browse.json
    │       │
    │       ├─→ 文件不存在 → 启动服务器
    │       ├─→ 进程死亡 → 杀死并重启
    │       └─→ 版本不匹配 → 杀死并重启
    │
    └─→ 等待服务器就绪（最多 8 秒）
            │
            └─→ 发送 POST /command
                    │
                    └─→ 打印响应
```

### 进程存活检测

| 平台 | 检测方式 |
|------|----------|
| Unix | `process.kill(pid, 0)` — 发送信号 0 |
| Windows | `tasklist /FI "PID eq N"` — 列出进程 |

```typescript
function isProcessAlive(pid: number): boolean {
  if (IS_WINDOWS) {
    // Windows: 慢速，仅用于一次性调用
    const result = Bun.spawnSync(['tasklist', '/FI', `PID eq ${pid}`]);
    return result.stdout.includes(`"${pid}"`);
  }
  // Unix: 快速
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
```

---

## 3.2 HTTP 服务器：Bun.serve 路由设计

### 服务器职责

- HTTP 监听（localhost + 随机端口）
- 命令调度（READ/WRITE/META）
- 状态文件写入
- 自动关闭定时器

### 路由结构

```typescript
Bun.serve({
  port: config.port,
  hostname: 'localhost',

  routes: {
    'GET /health': handleHealth,
    'GET /tabs': handleTabs,
    'GET /state': handleState,
    'POST /command': handleCommand,
    'POST /shutdown': handleShutdown,
  },
});
```

### 认证中间件

```typescript
const AUTH_TOKEN = crypto.randomUUID();  // 服务器启动时生成

function validateAuth(req: Request): boolean {
  const header = req.headers.get('authorization');
  return header === `Bearer ${AUTH_TOKEN}`;
}

async function handleCommand(req: Request): Promise<Response> {
  if (!validateAuth(req)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await req.json();
  const { cmd, args } = body;
  // 处理命令...
}
```

### 命令调度

```typescript
async function handleCommand(req: Request): Promise<Response> {
  const { cmd, args } = await req.json();

  if (READ_COMMANDS.has(cmd)) {
    return handleReadCommand(cmd, args, browserManager);
  }

  if (WRITE_COMMANDS.has(cmd)) {
    return handleWriteCommand(cmd, args, browserManager);
  }

  if (META_COMMANDS.has(cmd)) {
    return handleMetaCommand(cmd, args, browserManager, shutdown);
  }

  throw new Error(`Unknown command: ${cmd}`);
}
```

### 自动关闭定时器

```typescript
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 分钟

let idleTimer = setTimeout(shutdown, IDLE_TIMEOUT_MS);

// 每次命令重置定时器
async function handleCommand(...) {
  resetIdleTimer();
  // 处理命令...
}
```

---

## 3.3 浏览器管理器：生命周期与页面管理

### BrowserManager 核心职责

```typescript
class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private pages: Map<number, Page> = new Map();
  private activeTabId: number = 0;
  private refMap: Map<string, RefEntry> = new Map();
}
```

### 启动参数

```typescript
async launch() {
  const launchArgs: string[] = [];

  // Docker/CI: 禁用沙箱
  if (process.env.CI || process.env.CONTAINER) {
    launchArgs.push('--no-sandbox');
  }

  // 扩展支持（GStack Browser）
  if (extensionsDir) {
    launchArgs.push(
      `--disable-extensions-except=${extensionsDir}`,
      `--load-extension=${extensionsDir}`,
    );
  }

  this.browser = await chromium.launch({
    headless: true,
    args: launchArgs,
  });

  // 崩溃监听
  this.browser.on('disconnected', () => {
    console.error('[browse] Chromium crashed. Server exiting.');
    process.exit(1);  // 服务器退出，CLI 会自动重启
  });
}
```

### 崩溃处理哲学

```typescript
browser.on('disconnected', () => {
  // 不尝试自我修复——直接退出
  process.exit(1);
});

// CLI 检测到服务器死亡
if (!await isServerHealthy(port)) {
  await spawnNewServer();  // 自动重启
}
```

**设计原则：** 简单比聪明好。尝试重新连接半死的浏览器往往导致更多问题。

### 页面管理

```typescript
class BrowserManager {
  // 创建新标签页
  async newTab(url?: string): Promise<number> {
    const tabId = this.nextTabId++;
    const page = await this.context.newPage();
    this.pages.set(tabId, page);

    if (url) {
      await page.goto(url);
    }

    return tabId;
  }

  // 关闭标签页
  async closeTab(tabId: number): Promise<void> {
    const page = this.pages.get(tabId);
    if (page) {
      await page.close();
      this.pages.delete(tabId);
    }
  }

  // 切换标签页
  async switchTab(tabId: number): Promise<void> {
    if (!this.pages.has(tabId)) {
      throw new Error(`Tab ${tabId} not found`);
    }
    this.activeTabId = tabId;
  }

  // 获取当前页面
  getPage(): Page {
    return this.pages.get(this.activeTabId);
  }
}
```

### 标签页操作命令

| 命令 | 功能 |
|------|------|
| `tabs` | 列出所有打开的标签页 |
| `tab <id>` | 切换到指定标签页 |
| `newtab [url]` | 打开新标签页 |
| `closetab [id]` | 关闭标签页 |

---

## 3.4 Ref 系统：让 AI 操作元素的艺术

### 为什么需要 Ref？

传统方式让 AI 操作元素：

```typescript
// AI 需要记住这个脆弱的选择器
await page.click('button[data-testid="submit-form-123"]');
// 问题：页面重构后失效
// 问题：AI 不知道页面上有什么
```

gstack 的方式：

```
Agent:  $B snapshot -i
Server: 返回带 @e1, @e2... 标注的 ARIA 树
        @e1 [button] "Submit Form"
        @e2 [textbox] "Email"
        @e3 [link] "Forgot password?"

Agent:  $B click @e1
Server: 查找 @e1 → Locator.click()
```

### 快照流程

```typescript
async function handleSnapshot(args: string[]): Promise<string> {
  // 1. 解析参数
  const opts = parseSnapshotArgs(args);

  // 2. 获取 ARIA 树
  const page = browserManager.getPage();
  const ariaText = await page.locator('body').ariaSnapshot();

  // 3. 解析每行，分配 refs
  const lines = ariaText.split('\n');
  const refMap = new Map<string, RefEntry>();
  let refCounter = 1;

  // 4. 统计 role+name 用于 nth() 去重
  const roleNameCounts = countRoles(lines);

  // 5. 第二遍：分配 refs，构建 Locators
  for (const line of lines) {
    const node = parseLine(line);
    if (!node) continue;

    // 过滤非交互元素
    if (opts.interactive && !isInteractive(node.role)) {
      continue;
    }

    // 分配 ref
    const ref = `e${refCounter++}`;

    // 构建 Locator
    let locator = page.getByRole(node.role, { name: node.name });
    if (roleNameCounts.get(key) > 1) {
      locator = locator.nth(nth);  // 去重
    }

    refMap.set(ref, { locator, role: node.role, name: node.name });
  }

  // 6. 存储 ref map
  browserManager.setRefMap(refMap);

  // 7. 返回带标注的文本
  return formatOutput(lines, refMap);
}
```

### ARIA 树解析

ARIA 快照格式：

```
- heading "Test" [level=1]
- link "Link A":
  - /url: /a
- textbox "Name"
- paragraph: Some text
```

解析正则：

```typescript
const match = line.match(
  /^(\s*)-\s+(\w+)        // 缩进 + 角色
  (?:\s+"([^"]*)")?       // 名称（可选）
  (?:\s+(\[.*?\]))?\s*    // 属性（可选）
  (?::\s*(.*))?$/         // 内联文本（可选）
);
```

### nth() 去重

同一角色+名称可能多次出现：

```html
<div role="listbox">
  <div role="option">Apple</div>
  <div role="option">Apple</div>  <!-- 重名 -->
</div>
```

```typescript
const key = `${node.role}:${node.name || ''}`;
const count = roleNameCounts.get(key);  // 2
const nth = roleNameSeen.get(key) || 0; // 0, 1
roleNameSeen.set(key, nth + 1);

// 构建 Locator
let locator = page.getByRole('option', { name: 'Apple' });
if (count > 1) {
  locator = locator.nth(nth);  // 区分同名元素
}
```

### 快照标志

| 标志 | 功能 |
|------|------|
| `-i --interactive` | 仅交互元素（按钮、链接、输入框） |
| `-c --compact` | 紧凑输出（无空结构节点） |
| `-d --depth` | 限制树深度 |
| `-s --selector` | 限定 CSS 选择器范围 |
| `-D --diff` | 与上次快照对比 |
| `-a --annotate` | 带标注的截图 |
| `-C --cursor-interactive` | 扫描 cursor:pointer 等 |

---

## 3.5 命令注册表：集中式命令定义

### 命令分类

```typescript
export const READ_COMMANDS = new Set([
  'text', 'html', 'links', 'forms', 'accessibility',
  'js', 'eval', 'css', 'attrs',
  'console', 'network', 'cookies', 'storage', 'perf',
  'dialog', 'is', 'inspect',
]);

export const WRITE_COMMANDS = new Set([
  'goto', 'back', 'forward', 'reload',
  'click', 'fill', 'select', 'hover', 'type', 'press', 'scroll', 'wait',
  'viewport', 'cookie', 'cookie-import', 'cookie-import-browser',
  'header', 'useragent',
  'upload', 'dialog-accept', 'dialog-dismiss',
  'style', 'cleanup', 'prettyscreenshot',
]);

export const META_COMMANDS = new Set([
  'tabs', 'tab', 'newtab', 'closetab',
  'status', 'stop', 'restart',
  'screenshot', 'pdf', 'responsive',
  'chain', 'diff',
  'url', 'snapshot',
  'handoff', 'resume',
  'connect', 'disconnect', 'focus',
  'inbox', 'watch', 'state', 'frame',
]);
```

### 命令描述表

```typescript
export const COMMAND_DESCRIPTIONS: Record<string, {
  category: string;
  description: string;
  usage?: string;
}> = {
  'goto': {
    category: 'Navigation',
    description: 'Navigate to URL',
    usage: 'goto <url>',
  },
  'snapshot': {
    category: 'Snapshot',
    description: 'Accessibility tree with @e refs for element selection',
    usage: 'snapshot [flags]',
  },
  // ... 全部命令
};
```

### 不信任内容边界

```typescript
export function wrapUntrustedContent(result: string, url: string): string {
  // 防止通过 URL 注入边界标记
  const safeUrl = url.replace(/[\n\r]/g, '').slice(0, 200);

  // 防止内容中包含边界标记
  const safeResult = result.replace(
    /--- (BEGIN|END) UNTRUSTED EXTERNAL CONTENT/g,
    '--- $1 UNTRUSTED EXTERNAL C\u200BONTENT'
  );

  return `--- BEGIN UNTRUSTED EXTERNAL CONTENT (source: ${safeUrl}) ---
${safeResult}
--- END UNTRUSTED EXTERNAL CONTENT ---`;
}
```

---

## 3.6 环形缓冲区：O(1) 日志存储

### 为什么需要环形缓冲区？

传统列表追加：

```typescript
const logs: LogEntry[] = [];
logs.push(entry);  // O(1)

// 但内存无限增长！
```

环形缓冲区：

```typescript
class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private head: number = 0;    // 最早元素位置
  private _size: number = 0;

  push(entry: T): void {
    const index = (this.head + this._size) % this.capacity;
    this.buffer[index] = entry;

    if (this._size < this.capacity) {
      this._size++;
    } else {
      // 缓冲区满，头指针前移（覆盖最旧）
      this.head = (this.head + 1) % this.capacity;
    }
  }
}
```

### 内存布局

```
容量=6, head=4, size=5

┌───┬───┬───┬───┬───┬───┐
│ 3 │ 4 │ 5 │   │ 1 │ 2 │
└───┴───┴───┴───┴─▲─┴───┘
                  │
                head (最旧)
                size=5 (3,4,5,1,2)
```

### API

```typescript
const buffer = new CircularBuffer<LogEntry>(50000);

// 插入
buffer.push({ timestamp: Date.now(), level: 'log', text: 'Hello' });

// 获取全部（按插入顺序）
const all = buffer.toArray();

// 获取最近 N 条
const recent = buffer.last(100);

// 长度
buffer.length;        // 当前元素数
buffer.totalAdded;    // 总插入次数
```

### 三种日志缓冲区

| 缓冲区 | 类型 | 用途 |
|--------|------|------|
| consoleBuffer | LogEntry | 控制台消息 |
| networkBuffer | NetworkEntry | 网络请求/响应 |
| dialogBuffer | DialogEntry | 对话框事件 |

---

## 3.7 完整命令执行路径

让我们追踪 `$B click @e3` 的完整路径：

```
1. CLI (cli.ts)
   ├─→ 读取 .gstack/browse.json
   ├─→ HTTP POST /command
   │   { cmd: 'click', args: ['@e3'] }
   │
2. Server (server.ts)
   ├─→ validateAuth() — 验证 Bearer token
   ├─→ READ/WRITE/META 分类
   │   'click' ∈ WRITE_COMMANDS
   ├─→ handleWriteCommand('click', ['@e3'], browserManager)
   │
3. BrowserManager (browser-manager.ts)
   ├─→ refMap.get('e3') → RefEntry { locator, role, name }
   ├─→ refEntry.locator.click()
   │
4. 返回
   ├─→ JSON 响应 → CLI stdout
```

---

## 本章小结

1. **CLI 设计**：瘦包装器，职责清晰——读状态、查健康、发请求
2. **HTTP 服务器**：Bun.serve 路由 + 命令分类调度 + 自动关闭
3. **浏览器管理器**：Chromium 生命周期 + 页面/标签页 + 崩溃即退出
4. **Ref 系统**：ARIA 树 → 解析 → nth() 去重 → Locator 映射
5. **命令注册表**：集中式定义 + 分类调度 + 不信任内容边界
6. **环形缓冲区**：O(1) 追加 + 有界内存 + 覆盖最旧

---

## 预告

第4章我们将深入 **SKILL 系统**：SKILL.md 模板如何工作？Preamble 如何统一技能行为？Review Army 如何协调多个专家？

<!-- DRAFT_COMPLETE -->
