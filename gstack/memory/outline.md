# gstack 源码解读 — 书籍大纲

## 基本信息

| 属性 | 值 |
|------|-----|
| 书籍名称 | 《AI 工程流水线：gstack 源码深度解读》 |
| 源码位置 | /Users/yaya/.openclaw/workspace/gstack |
| 目标读者 | 3年以上经验的后端工程师、对 AI 辅助编程感兴趣的技术管理者 |
| 章节数量 | 10 章 |
| 并行批次 | 3 章/批 |

---

## 章节大纲

### 第一部分：架构与核心机制

| 章节 | 标题 | 目的 |
|------|------|------|
| ch01 | gstack 是什么：AI 工程流水线的愿景 | 介绍项目背景、设计理念和应用场景 |
| ch02 | 整体架构：守护进程模型与通信设计 | 解析 daemon 架构、状态文件、版本管理等核心设计 |
| ch03 | 持久化浏览器：CDP 协议与 Playwright 集成 | 深入浏览器管理、Cookie 安全、Ref 引用系统 |

### 第二部分：SKILL 系统

| 章节 | 标题 | 目的 |
|------|------|------|
| ch04 | SKILL.md 模板系统：Markdown 即配置 | 解析模板→生成的自动化文档系统 |
| ch05 | 核心技能解析：/plan、/review、/ship | 深入三大核心技能的内部逻辑 |
| ch06 | 专业化审查流水线：autoplan 与 review-army | 解析多阶段审查框架设计 |

### 第三部分：多 Agent 适配

| 章节 | 标题 | 目的 |
|------|------|------|
| ch07 | Host 适配层：统一抽象与插件化设计 | 解析 hosts/ 目录下的适配器模式 |
| ch08 | 8大 AI 代理支持：Claude/Codex/Cursor 等 | 对比各 Agent 的适配差异与实现要点 |

### 第四部分：高级特性与最佳实践

| 章节 | 标题 | 目的 |
|------|------|------|
| ch09 | 安全机制：freeze/guard/careful | 解析防误操作的安全设计 |
| ch10 | 构建与发布：从源码到 58MB 可执行文件 | 解析 Bun 编译、版本管理、自动更新机制 |

---

## 章节详细说明

### ch01: gstack 是什么
- 项目起源：Garry Tan 的 AI 编程愿景
- 解决的问题：AI Agent 与浏览器的状态持久化
- 核心价值：把 AI 变成"虚拟工程团队"
- 典型工作流示例

### ch02: 整体架构
- 守护进程模型 vs 每命令启动浏览器
- 状态文件机制（.gstack/browse.json）
- 版本自动重启机制
- 安全性设计（Bearer token、localhost only）

### ch03: 持久化浏览器
- Playwright + CDP 协议集成
- Cookie 安全：Keychain 访问、内存解密
- Ref 引用系统：@e1、@c1 的生成与解析
- 日志架构：环形缓冲区设计

### ch04: SKILL.md 模板系统
- SKILL.md.tmpl → SKILL.md 自动生成
- 占位符机制（{{COMMAND_REFERENCE}} 等）
- preamble 注入逻辑
- 工具权限控制

### ch05: 核心技能解析
- /plan-ceo-review：产品视角审查
- /plan-eng-review：架构与数据流
- /review：代码审查
- /ship：发布流水线

### ch06: 专业化审查流水线
- autoplan 自动审查编排
- review-army 多专家并行
- decision principles 自动决策
- 审批门控机制

### ch07: Host 适配层
- HostConfig 接口设计
- 适配器模式实现
- 动态主机发现
- 跨 Agent 能力抽象

### ch08: 8大 AI 代理支持
- Claude Code（原生支持）
- OpenAI Codex CLI
- Cursor
- OpenCode
- Factory Droid
- Slate
- Kiro
- OpenClaw

### ch09: 安全机制
- careful：破坏性命令警告
- freeze：目录锁定
- guard：双重保护
- 执行前的确认流程

### ch10: 构建与发布
- Bun 编译：--compile 产出单文件
- gstack-upgrade：增量更新机制
- Supabase 云函数集成
- 遥测与使用统计

---

## 附录（可选）

- A. 贡献指南
- B. 故障排查
- C. 术语表

