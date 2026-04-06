# 《AI 工程流水线：gstack 源码深度解读》术语表

## 使用说明

- 📌 **保留英文** 的术语在正文中直接使用英文原文
- 🔄 **翻译术语** 首次出现时格式为：中文翻译（English Original）
- ⚠️ 新增术语必须在本表中注册后才能在正文中使用
- 🔍 按英文字母排序，便于快速查找

## 术语总表

| 英文术语 | 中文翻译 | 首次出现 | 定义 | 注意事项 |
|----------|----------|----------|------|----------|
| bearer token | 持有者令牌 | ch02 | 一种 HTTP 认证凭据，客户端在请求头中携带 `Authorization: Bearer <token>` 即可证明身份。 | 与 API Key 类似，但不以 `key=` 开头传输 |
| circular buffer | 环形缓冲区 | ch03 | 固定大小的缓冲区，新数据覆盖旧数据的结构。头尾相连形成"环"，O(1) 插入。 | 不要与"队列（queue）"混淆，环形缓冲区容量固定 |
| daemon | 守护进程 | ch02 | 后台运行的长期进程，不受终端控制。gstack 的浏览器服务以 daemon 形式运行。 | 发音 "day-mon"，不是 "demon"（恶魔） |
| headless browser | 无头浏览器 | ch03 | 无可视化界面的浏览器，通过程序控制。gstack 使用 Chromium headless 模式。 | 区别于普通浏览器，不需要显示器 |
| Host | 主机适配器 | ch07 | gstack 中对接不同 AI 编程工具（Claude Code、Codex 等）的适配层。 | 不要与"宿主机"混淆，特指 AI Agent 适配 |
| Locator | 定位器 | ch03 | Playwright 中用于定位页面元素的 API。相比 CSS 选择器，更稳定且支持语义查询。 | Playwright 独有概念，不是 DOM API |
| plaintext | 明文 | ch03 | 未加密的原始文本数据。Cookie 等敏感信息在传输前必须是明文（解密后）。 | 注意区分"明文传输"和"明文存储" |
| preamble | 前导脚本 | ch04 | SKILL.md 文件开头的 shell 脚本块，在技能执行前运行，用于环境检测。 | 不是"序言"，特指技术实现 |
| Ref / Element Reference | 元素引用 | ch03 | gstack 为页面元素分配的语义化标签（如 `@e1`、`@c2`），让 AI 无需 CSS 选择器即可操作元素。 | 是 gstack 的核心创新，与 React ref 不同 |
| Ring buffer | 环形缓冲区 | ch03 | 同 circular buffer，本书统一使用"环形缓冲区"。 | 见 circular buffer |
| skill | 技能 | ch01 | gstack 中以 `/skill-name` 调用的结构化工作流程，如 `/review`、`/ship`。 | 不要与"插件"混淆，skill 是 prompt + 流程 |
| snapshot | 快照 | ch03 | 页面当前状态的可访问性树（accessibility tree）表示，用于生成 Ref 标签。 | 不是屏幕截图，是 DOM 结构快照 |
| template | 模板 | ch04 | `.tmpl` 后缀的文件，包含占位符的 Markdown 源文件，通过 gen-skill-docs.ts 生成最终 SKILL.md。 | 模板 ≠ 最终文件 |
| Agent | —（保留英文） | ch01 | AI 编程工具的统称，如 Claude Code、Cursor。本书中 Agent = AI coding assistant。 | 区分"软件代理（software agent）" |

## 缩写表

| 缩写 | 全称 | 中文 |
|------|------|------|
| ACP | Agent Communication Protocol | Agent 通信协议 |
| API | Application Programming Interface | 应用程序接口 |
| CDP | Chrome DevTools Protocol | Chrome 开发者工具协议 |
| CLI | Command Line Interface | 命令行接口 |
| CSP | Content Security Policy | 内容安全策略 |
| DB | Database | 数据库 |
| HTTP | HyperText Transfer Protocol | 超文本传输协议 |
| PID | Process ID | 进程标识符 |
| RLS | Row Level Security | 行级安全策略 |
| SPA | Single Page Application | 单页应用 |
| SQL | Structured Query Language | 结构化查询语言 |
| SSH | Secure Shell | 安全外壳协议 |
| UUID | Universal Unique Identifier | 通用唯一标识符 |

## gstack 特有概念

| 术语 | 定义 | 首次出现 |
|------|------|----------|
| browse daemon | 持久化浏览器服务进程，通过 HTTP 与 CLI 通信 | ch02 |
| browse.json | 存储 daemon 状态（PID、端口、token）的文件 | ch02 |
| freeze | 锁定目录编辑权限的安全机制 | ch09 |
| guard | careful + freeze 的组合保护 | ch09 |
| review-army | 多专家并行审查框架 | ch06 |
| skill prefix | gstack 的 `/` 命令名前缀，支持 `/gstack-*` 命名空间 | ch07 |
| worktree | Git worktree 管理工具 | ch10 |

## 术语决策记录

### Host vs Adapter
- **候选翻译**: 主机适配器 / 适配器 / 宿主
- **最终选择**: 主机适配器（简称"主机"）
- **理由**: "适配器"过于通用，"宿主"容易与 Docker 混淆。"主机适配器"明确表达其对接角色的语义。

### skill vs command
- **最终选择**: 统一使用"技能"，命令特指 CLI 参数
- **理由**: `/review` 是"技能"，`gstack --help` 是"命令"。避免混淆。

