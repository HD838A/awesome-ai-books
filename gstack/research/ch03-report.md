# ch03 研究报告：持久化浏览器核心实现

## 研究目标

深入理解 gstack browse 模块的核心实现：CLI 如何工作、服务器如何调度命令、浏览器如何管理、Ref 系统如何实现。

---

## 1. CLI 实现 (cli.ts)

### 1.1 CLI 职责

CLI 是一个**瘦包装器**，负责：
1. 读取状态文件获取端口和 token
2. 健康检查 + 版本检测
3. 启动服务器（如需要）
4. 发送 HTTP POST 请求
5. 打印响应到 stdout

### 1.2 启动流程

```
CLI 调用: $B snapshot -i
    ↓
1. readState() → 读取 .gstack/browse.json
    ↓ (文件不存在或进程死亡)
2. killServer() → 杀死旧服务器
    ↓
3. spawnServer() → 启动新服务器（后台运行）
    ↓
4. isServerHealthy(port) → 健康检查（最多等待8秒）
    ↓
5. fetch('http://127.0.0.1:PORT/command', {
     method: 'POST',
     headers: { 'Authorization': `Bearer ${token}` },
     body: JSON.stringify({ cmd: 'snapshot', args: ['-i'] })
   })
    ↓
6. 打印响应
```

### 1.3 进程存活检测

| 平台 | 检测方式 |
|------|----------|
| Unix | `process.kill(pid, 0)` |
| Windows | `tasklist /FI "PID eq N"` (慢速，仅用于一次性调用) |

**Windows 特殊处理：** Bun 编译的二进制无法发送信号到 Windows PID，使用 tasklist 替代。

### 1.4 服务器脚本解析

```typescript
// 开发模式：直接运行 server.ts
if (fs.existsSync(path.resolve(metaDir, 'server.ts'))) {
  return path.resolve(metaDir, 'server.ts');
}

// 编译模式：从二进制路径推导
const adjacent = path.resolve(path.dirname(execPath), '..', 'src', 'server.ts');
```

---

## 2. 服务器实现 (server.ts)

### 2.1 服务器职责

- HTTP 服务器（Bun.serve）
- 命令调度（READ/WRITE/META）
- 状态文件写入
- 环形缓冲区管理
- 自动关闭定时器

### 2.2 路由结构

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
    // Cookie picker 路由...
  }
});
```

### 2.3 命令调度

```typescript
async function handleCommand(req: Request): Promise<Response> {
  const body = await req.json();
  const { cmd, args } = body;

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

### 2.4 自动关闭定时器

```typescript
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 分钟

let idleTimer = setTimeout(() => {
  shutdown();
}, IDLE_TIMEOUT_MS);

// 每次命令重置定时器
function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(shutdown, IDLE_TIMEOUT_MS);
}
```

---

## 3. 浏览器管理器 (browser-manager.ts)

### 3.1 BrowserManager 核心职责

- Chromium 生命周期管理
- 页面/标签页管理
- Ref 映射表维护
- Cookie/存储状态

### 3.2 启动参数

```typescript
const launchArgs: string[] = [];

// Docker/CI: 禁用沙箱
if (process.env.CI || process.env.CONTAINER) {
  launchArgs.push('--no-sandbox');
}

// 扩展支持
if (extensionsDir) {
  launchArgs.push(
    `--disable-extensions-except=${extensionsDir}`,
    `--load-extension=${extensionsDir}`,
    '--window-position=-9999,-9999',
    '--window-size=1,1',
  );
  useHeadless = false;
}
```

### 3.3 崩溃处理

```typescript
browser.on('disconnected', () => {
  console.error('[browse] FATAL: Chromium process crashed. Server exiting.');
  process.exit(1);
});
```

**设计原则：** 不尝试自我修复。服务器退出后，CLI 检测到并自动重启。

### 3.4 页面管理

```typescript
class BrowserManager {
  private pages: Map<number, Page> = new Map();
  private activeTabId: number = 0;
  private nextTabId: number = 1;

  async newTab(url?: string): Promise<number> {
    const tabId = this.nextTabId++;
    const page = await this.context.newPage();
    this.pages.set(tabId, page);

    if (url) {
      await page.goto(url);
    }

    return tabId;
  }

  async closeTab(tabId: number): Promise<void> {
    const page = this.pages.get(tabId);
    if (page) {
      await page.close();
      this.pages.delete(tabId);
    }
  }

  async switchTab(tabId: number): Promise<void> {
    if (!this.pages.has(tabId)) {
      throw new Error(`Tab ${tabId} not found`);
    }
    this.activeTabId = tabId;
  }
}
```

---

## 4. Ref 系统实现 (snapshot.ts)

### 4.1 快照流程

```
handleSnapshot(args, bm)
    ↓
parseSnapshotArgs(args) → 解析 -i, -c, -d 等标志
    ↓
rootLocator.ariaSnapshot() → 获取 ARIA 树
    ↓
parseLine() → 解析每行
    ↓
roleNameCounts 统计 → 用于 nth() 去重
    ↓
分配 @e1, @e2, @e3... refs
    ↓
构建 Playwright Locator
    ↓
bm.setRefMap(refMap) → 存储引用映射
    ↓
返回带标注的文本输出
```

### 4.2 ARIA 角色分类

```typescript
const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'textbox', 'checkbox', 'radio',
  'combobox', 'listbox', 'menuitem', 'option',
  'searchbox', 'slider', 'spinbutton', 'switch', 'tab', 'treeitem',
]);
```

### 4.3 解析 ARIA 树行

```typescript
// 格式示例：
// - heading "Test" [level=1]
// - link "Link A":
//   - /url: /a
// - textbox "Name"
// - paragraph: Some text

const match = line.match(
  /^(\s*)-\s+(\w+)(?:\s+"([^"]*)")?(?:\s+(\[.*?\]))?\s*(?::\s*(.*))?$/
);
```

### 4.4 nth() 去重

```typescript
// 同一角色+名称出现多次时，使用 nth() 区分
const key = `${node.role}:${node.name || ''}`;
const count = roleNameCounts.get(key);
const nth = roleNameSeen.get(key) || 0;
roleNameSeen.set(key, nth + 1);

// 构建 Locator
const locator = page.getByRole(node.role, { name: node.name });
if (count > 1) {
  locators.push(locator.nth(nth));
}
```

### 4.5 快照标志

| 标志 | 功能 |
|------|------|
| `-i --interactive` | 仅交互元素（按钮、链接、输入框） |
| `-c --compact` | 紧凑输出（无空结构节点） |
| `-d --depth` | 限制树深度 |
| `-s --selector` | 限定 CSS 选择器范围 |
| `-D --diff` | 与上次快照对比 |
| `-a --annotate` | 带标注的截图 |
| `-o --output` | 标注截图输出路径 |
| `-C --cursor-interactive` | 扫描 cursor:pointer 等 |

---

## 5. 命令注册表 (commands.ts)

### 5.1 命令分类

```typescript
export const READ_COMMANDS = new Set([
  'text', 'html', 'links', 'forms', 'accessibility',
  'js', 'eval', 'css', 'attrs',
  'console', 'network', 'cookies', 'storage', 'perf',
  'dialog', 'is',
  'inspect',
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
  'inbox',
  'watch',
  'state',
  'frame',
]);
```

### 5.2 不信任内容处理

```typescript
export function wrapUntrustedContent(result: string, url: string): string {
  const safeUrl = url.replace(/[\n\r]/g, '').slice(0, 200);
  const safeResult = result.replace(
    /--- (BEGIN|END) UNTRUSTED EXTERNAL CONTENT/g,
    '--- $1 UNTRUSTED EXTERNAL C\u200BONTENT'
  );
  return `--- BEGIN UNTRUSTED EXTERNAL CONTENT (source: ${safeUrl}) ---\n${safeResult}\n--- END UNTRUSTED EXTERNAL CONTENT ---`;
}
```

---

## 6. 环形缓冲区 (buffers.ts)

### 6.1 数据结构

```typescript
class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private head: number = 0;      // 最早元素位置
  private _size: number = 0;
  private _totalAdded: number = 0;
  readonly capacity: number;

  push(entry: T): void {
    const index = (this.head + this._size) % this.capacity;
    this.buffer[index] = entry;

    if (this._size < this.capacity) {
      this._size++;
    } else {
      // 缓冲区满，头指针前移（覆盖最旧）
      this.head = (this.head + 1) % this.capacity;
    }

    this._totalAdded++;
  }

  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this._size; i++) {
      result.push(this.buffer[(this.head + i) % this.capacity] as T);
    }
    return result;
  }
}
```

### 6.2 内存布局

```
容量=6, head=4, size=5

┌───┬───┬───┬───┬───┬───┐
│ 3 │ 4 │ 5 │   │ 1 │ 2 │
└───┴───┴───┴───┴─▲─┴───┘
                  │
                head (最旧)
```

### 6.3 API

| 方法 | 说明 |
|------|------|
| `push(entry)` | O(1) 插入 |
| `toArray()` | 返回插入顺序的所有元素 |
| `last(n)` | 返回最近 n 个元素 |
| `get(index)` | 按索引获取 |
| `set(index, entry)` | 按索引设置 |
| `clear()` | 清空缓冲区 |
| `length` | 当前元素数量 |
| `totalAdded` | 总插入次数 |

---

## 7. Cookie 导入机制

### 7.1 导入流程

```typescript
async function cookieImportBrowser(browser: string, domain?: string) {
  // 1. 检测浏览器（Chrome, Arc, Brave, Edge）
  const browserPath = detectBrowser(browser);

  // 2. 复制 Cookie 数据库到临时文件
  const tempDb = await copyToTemp(browserPath.cookiePath);

  // 3. 打开只读连接
  const db = new Database(tempDb, { readonly: true });

  // 4. 读取 Cookie
  const cookies = db.query('SELECT * FROM cookies WHERE ...').all();

  // 5. 解密 Cookie 值（从 Keychain 获取密钥）
  const decrypted = cookies.map(c => decryptCookie(c));

  // 6. 导入到 Playwright context
  await context.addCookies(decrypted);
}
```

### 7.2 浏览器检测

| 浏览器 | 路径 |
|--------|------|
| Chrome | `~/Library/Application Support/Google/Chrome/` |
| Arc | `~/Library/Application Support/Arc/` |
| Brave | `~/Library/Application Support/BraveSoftware/` |
| Edge | `~/Library/Application Support/Microsoft Edge/` |

---

## 8. 源码位置

| 文件 | 内容 |
|------|------|
| `browse/src/cli.ts` | CLI 入口，服务器管理 |
| `browse/src/server.ts` | HTTP 服务器，路由，命令调度 |
| `browse/src/browser-manager.ts` | 浏览器生命周期，页面管理 |
| `browse/src/snapshot.ts` | Ref 系统，ARIA 树解析 |
| `browse/src/commands.ts` | 命令注册表 |
| `browse/src/buffers.ts` | 环形缓冲区实现 |
| `browse/src/read-commands.ts` | 读取命令实现 |
| `browse/src/write-commands.ts` | 写入命令实现 |
| `browse/src/meta-commands.ts` | Meta 命令实现 |
| `browse/src/cookie-import-browser.ts` | Cookie 导入 |

<!-- RESEARCH_COMPLETE -->
