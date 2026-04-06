# ch02 研究报告：gstack 的整体架构

## 研究目标

理解 gstack 的核心架构决策：为什么选择守护进程模型？为什么用 Bun？状态管理如何工作？Ref 系统如何设计？

---

## 1. 核心架构图

```
Claude Code                     gstack
─────────                      ──────
                               ┌──────────────────────┐
  Tool call: $B snapshot -i    │  CLI (compiled binary)│
  ─────────────────────────→   │  • reads state file   │
                               │  • POST /command      │
                               │    to localhost:PORT   │
                               └──────────┬───────────┘
                                          │ HTTP
                               ┌──────────▼───────────┐
                               │  Server (Bun.serve)   │
                               │  • dispatches command  │
                               │  • talks to Chromium   │
                               │  • returns plain text  │
                               └──────────┬───────────┘
                                          │ CDP
                               ┌──────────▼───────────┐
                               │  Chromium (headless)   │
                               │  • persistent tabs     │
                               │  • cookies carry over  │
                               │  • 30min idle timeout  │
                               └───────────────────────┘
```

**关键数据：**
- 首次调用启动时间：~3秒
- 后续每次调用：~100-200ms

---

## 2. 为什么选择守护进程模型？

### 2.1 传统方案的问题：每次命令启动浏览器

使用 Playwright 每次启动 Chromium 需要 ~2-3秒。如果 QA 会话有 20+ 命令，这就是 40+ 秒的启动开销。

更严重的是：**状态全部丢失。**

| 状态 | 每次启动丢失 |
|------|-------------|
| 登录 Cookie | ❌ 需重新登录 |
| 打开的标签页 | ❌ 需重新打开 |
| localStorage | ❌ 需重新设置 |
| 用户会话 | ❌ 需重新认证 |

### 2.2 守护进程模型的优势

| 优势 | 说明 |
|------|------|
| **持久化状态** | 登录一次，保持登录；打开的标签页保持打开 |
| **亚秒级响应** | 首次调用后，每次调用只是 HTTP POST，~100-200ms |
| **自动生命周期** | 首次使用自动启动，空闲30分钟后自动关闭 |
| **零配置** | 无需管理进程 |

### 2.3 守护进程生命周期

```
1. CLI 首次调用 → 检查 .gstack/browse.json
2. 文件不存在 → 启动新服务器（随机端口 10000-60000）
3. 服务器启动 → 写入状态文件（PID、端口、token、版本）
4. HTTP 请求 → CLI 读取状态文件 → POST /command
5. 30分钟空闲 → 服务器自动关闭
```

---

## 3. 为什么选择 Bun？

Bun 不是必须的，但它是**最佳选择**。

### 3.1 四大优势

| 优势 | 具体说明 |
|------|----------|
| **编译成二进制** | `bun build --compile` 生成 ~58MB 单文件可执行文件，无 `node_modules`，无需配置 PATH |
| **原生 SQLite** | Cookie 解密直接读取 Chromium 的 SQLite 数据库，无需 `better-sqlite3` |
| **原生 TypeScript** | `bun run server.ts` 直接运行，无需编译步骤 |
| **内置 HTTP 服务器** | `Bun.serve()` 快速简单，无需 Express/Fastify |

### 3.2 编译二进制的意义

gstack 安装到 `~/.claude/skills/` —— 这是用户**不希望管理 Node.js 项目的目录**。

```
传统方式：          gstack 方式：
├── package.json   └── gstack (单文件可执行)
├── node_modules   └── 0 配置
├── bun.lockb      └── 直接运行
└── tsconfig.json
```

### 3.3 性能对比

| 指标 | Node.js | Bun |
|------|---------|-----|
| 二进制启动 | ~100ms | ~1ms |
| SQLite 支持 | 需插件 | 内置 |
| TypeScript | 需编译 | 直接运行 |

---

## 4. 状态文件机制

### 4.1 状态文件结构

`.gstack/browse.json` 存储服务器会话信息：

```json
{
  "pid": 12345,
  "port": 34567,
  "token": "uuid-v4",
  "startedAt": "2024-01-01T00:00:00Z",
  "binaryVersion": "abc123"
}
```

### 4.2 原子写入

```
写入流程：
1. 写入 .gstack/.browse.json.tmp（临时文件）
2. 重命名为 .gstack/browse.json
3. 设置权限 0o600（仅所有者可读写）
```

**为什么用原子写入？** 防止文件在写入过程中被读取导致状态不一致。

### 4.3 端口选择

- 随机端口 10000-60000
- 最多重试5次（避免端口冲突）
- **优势：** 10个 Conductor 工作区可以各自运行独立浏览守护进程，零配置、零冲突

### 4.4 版本自动重启

```
构建时：
1. git rev-parse HEAD → browse/dist/.version

运行时：
1. CLI 检查二进制版本 vs 服务器 binaryVersion
2. 不匹配 → 杀死旧服务器，启动新服务器
```

**解决的问题：** "过时二进制"类 bug——重新构建后，下次命令自动使用新版本。

---

## 5. 安全模型

### 5.1 三层安全防护

| 层级 | 机制 | 说明 |
|------|------|------|
| **网络层** | localhost only | HTTP 服务器绑定 localhost，不暴露到网络 |
| **认证层** | Bearer token | UUID v4 token，每次请求必须携带 |
| **文件层** | 0o600 权限 | 状态文件仅所有者可读写 |

### 5.2 Bearer Token 认证流程

```
1. 服务器启动 → 生成随机 UUID token
2. 写入 .gstack/browse.json（mode 0o600）
3. 每个 HTTP 请求 → 必须包含 Authorization: Bearer <token>
4. 不匹配 → 返回 401 Unauthorized
```

**例外：** `/health` 和 Cookie picker UI 无需 token（localhost only）。

### 5.3 Cookie 安全

| 安全措施 | 说明 |
|----------|------|
| Keychain 需用户批准 | macOS 对话框首次导入时弹出 |
| 内存解密 | Cookie 在进程中解密，不写磁盘 |
| 数据库只读 | 复制到临时文件打开，避免锁定冲突 |
| Key 仅会话缓存 | 服务器关闭时缓存清空 |
| 日志不含 Cookie | console/network/dialog 从不记录 Cookie 值 |

---

## 6. Ref 系统

### 6.1 问题：如何让 AI 操作页面元素？

传统方式：CSS selector 或 XPath
```typescript
await page.click('button[data-testid="submit"]');
```

**问题：** 选择器脆弱，页面变化即失效。

### 6.2 Ref 系统的工作原理

```
Agent 调用：  $B snapshot -i

执行流程：
1. 调用 Playwright page.accessibility.snapshot()
2. 遍历 ARIA 树，分配序号 @e1, @e2, @e3...
3. 为每个 ref 构建 Playwright Locator：
   getByRole(role, { name }).nth(index)
4. 存储 Map<string, RefEntry>（role + name + Locator）
5. 返回带标注的纯文本树

Agent 调用：  $B click @e3

执行流程：
1. 解析 @e3 → RefEntry
2. 定位器执行 .click()
```

### 6.3 为什么用 Locator 而不是 DOM 注入？

| 方案 | 问题 |
|------|------|
| DOM 注入 `data-ref="@e1"` | CSP 阻止、框架水合冲突、Shadow DOM 穿透不了 |
| **Locator（gstack 方案）** | 外部查询，无 DOM 改动，无框架冲突 |

### 6.4 Ref 生命周期

| 事件 | Ref 状态 |
|------|----------|
| navigation（主框架） | **全部清除**——URL 改变后 locators 失效 |
| 页面内容变化（React router 等） | **检测失效**——resolveRef() 执行 count() 检查 |

### 6.5 失效检测

```typescript
resolveRef(@e3) → entry = refMap.get("e3")
                → count = await entry.locator.count()
                → if count === 0: throw "Ref @e3 is stale..."
                → if count > 0: return { locator }
```

**优势：** 快速失败（~5ms）而不是等待 30 秒超时。

### 6.6 Cursor-interactive refs (@c)

`-C` 标志捕获可点击但不在 ARIA 树中的元素：
- `cursor: pointer` 的元素
- `onclick` 属性的元素
- 自定义 `tabindex`

这些获取 `@c1`, `@c2` 等 refs（独立命名空间）。

---

## 7. 日志架构

### 7.1 三环缓冲区（Ring Buffers）

```
控制台消息 ──→ CircularBuffer #1 (50,000 条)
网络请求  ──→ CircularBuffer #2 (50,000 条)
对话框事件 ──→ CircularBuffer #3 (50,000 条)
```

### 7.2 环形缓冲区特性

| 特性 | 说明 |
|------|------|
| O(1) 插入 | 无论多少数据，插入时间恒定 |
| 有界内存 | 50K × 3 = 150K 条目上限 |
| 追加写入 | 磁盘文件只追加，可被外部工具读取 |

### 7.3 异步刷新

```
刷新流程：
1. 服务器内存缓冲区累积日志
2. 每秒异步刷新到磁盘（.gstack/*.log）
3. HTTP 请求处理从不阻塞
4. 服务器崩溃最多丢失 1 秒数据
```

**命令读取：** `console`、`network`、`dialog` 命令从内存缓冲区读取（不读磁盘）。

---

## 8. SKILL.md 模板系统

### 8.1 问题：文档与代码漂移

手工维护 SKILL.md → 代码更新后文档过期 → Agent 执行失败。

### 8.2 解决方案：模板 + 自动生成

```
SKILL.md.tmpl          （人工编写的工作流 + 提示）
       ↓
gen-skill-docs.ts      （读取源码元数据）
       ↓
SKILL.md               （提交版本，含自动生成部分）
```

### 8.3 占位符系统

| 占位符 | 来源 | 生成内容 |
|--------|------|----------|
| `{{COMMAND_REFERENCE}}` | commands.ts | 按类别分类的命令表 |
| `{{SNAPSHOT_FLAGS}}` | snapshot.ts | 标志参考 + 示例 |
| `{{PREAMBLE}}` | gen-skill-docs.ts | 更新检查、会话追踪、ELI16 模式 |
| `{{BROWSE_SETUP}}` | gen-skill-docs.ts | 二进制发现 + 安装说明 |
| `{{BASE_BRANCH_DETECT}}` | gen-skill-docs.ts | 动态基础分支检测 |
| `{{QA_METHODOLOGY}}` | gen-skill-docs.ts | /qa 和 /qa-only 共享 QA 方法论 |
| `{{REVIEW_DASHBOARD}}` | gen-skill-docs.ts | /ship 预检审查就绪仪表板 |
| `{{TEST_BOOTSTRAP}}` | gen-skill-docs.ts | 测试框架检测、引导、CI/CD 设置 |

### 8.4 为什么提交生成结果而不是运行时生成？

| 原因 | 说明 |
|------|------|
| Claude 读取时机 | SKILL.md 在技能加载时读取，无构建步骤 |
| CI 验证 | `gen:skill-docs --dry-run` + `git diff --exit-code` |
| Git blame | 可追溯命令添加时间和提交 |

### 8.5 测试层级

| 层级 | 内容 | 成本 | 速度 |
|------|------|------|------|
| 1 — 静态验证 | 解析每个 `$B` 命令，验证注册表 | 免费 | <2秒 |
| 2 — E2E via `claude -p` | 生成真实 Claude 会话，运行每个技能 | ~$3.85 | ~20分钟 |
| 3 — LLM 评判 | Sonnet 评分文档清晰度/完整性 | ~$0.15 | ~30秒 |

---

## 9. 命令调度

### 9.1 命令分类

| 类别 | 特点 | 命令示例 |
|------|------|----------|
| **READ** | 无变更，可安全重试 | text, html, links, console, cookies |
| **WRITE** | 变更页面状态，非幂等 | goto, click, fill, press |
| **META** | 服务器级操作 | snapshot, screenshot, tabs, chain |

### 9.2 调度实现

```typescript
if (READ_COMMANDS.has(cmd))  → handleReadCommand(cmd, args, bm)
if (WRITE_COMMANDS.has(cmd)) → handleWriteCommand(cmd, args, bm)
if (META_COMMANDS.has(cmd))  → handleMetaCommand(cmd, args, bm, shutdown)
```

---

## 10. 错误哲学

### 10.1 错误为 AI 而设计

每个错误消息必须**可操作**：

| 错误 | 改进版 |
|------|--------|
| "Element not found" | "Element not found or not interactable. Run `snapshot -i` to see available elements." |
| "Selector matched multiple elements" | "Selector matched multiple elements. Use @refs from `snapshot` instead." |
| Timeout | "Navigation timed out after 30s. The page may be slow or the URL may be wrong." |

### 10.2 崩溃恢复

```
Chromium 崩溃 → browser.on('disconnected')
                → 服务器立即退出
                → CLI 检测到死亡服务器
                → 自动重启
```

**设计原则：** 不尝试自我修复——比尝试重新连接半死浏览器更简单可靠。

---

## 11. E2E 测试基础设施

### 11.1 会话运行器架构

```
  skill-e2e-*.test.ts
        │
        │ 生成 runId，传递 testName + runId
        │
  ┌─────┼──────────────────────────────────────┐
  │     │                                      │
  │  runSkillTest()              evalCollector │
  │  (session-runner.ts)        (eval-store.ts) │
  │     │                             │         │
  │  每工具调用：               每 addTest()：  │
  │  [心跳] [进度] [NDJSON]    savePartial()   │
  │     │                             │         │
  │  e2e-live.json              _partial-e2e   │
  │  progress.log                    .json     │
  │  *.ndjson                                          │
  └──────────────────────────────────────────────────┘
```

### 11.2 非致命原则

所有观测 I/O 用 try/catch 包装。写入失败从不导致测试失败——测试本身是真相来源，观测是尽力而为。

### 11.3 机器可读诊断

每个测试结果包含：
- `exit_reason`（success, timeout, error_max_turns, error_api, exit_code_N）
- `timeout_at_turn`
- `last_tool_call`

支持 `jq` 查询：
```bash
jq '.tests[] | select(.exit_reason == "timeout") | .last_tool_call' ~/.gstack-dev/evals/_partial-e2e.json
```

---

## 12. 源码位置

| 文件 | 内容 |
|------|------|
| `ARCHITECTURE.md` | 完整架构文档（主力参考） |
| `browse/src/cli.ts` | CLI 入口 |
| `browse/src/server.ts` | HTTP 服务器 |
| `browse/src/browser-manager.ts` | 浏览器管理器 |
| `browse/src/snapshot.ts` | Ref 系统实现 |
| `browse/src/buffers.ts` | 环形缓冲区 |
| `scripts/gen-skill-docs.ts` | 模板生成器 |
| `test/helpers/session-runner.ts` | E2E 测试运行器 |
| `test/helpers/eval-store.ts` | 评估数据存储 |

<!-- RESEARCH_COMPLETE -->
