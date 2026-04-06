# ch01 研究报告：gstack 是什么

## 研究目标

深入理解 gstack 的愿景、定位、核心价值主张，以及它试图解决的问题。

---

## 1. 项目背景与创始人

### 1.1 Garry Tan 的故事

gstack 由 **Garry Tan**（Y Combinator 现任 CEO）创建。他的背景：
- 20年产品开发经验
- 曾是 Palantir 早期工程师/PM
- 联合创始人 Posterous（被 Twitter 收购）
- 构建了 YC 内部社交网络 Bookface

**关键引用：**
> "I don't think I've typed like a line of code probably since December, basically, which is an extremely large change."
> — Andrej Karpathy, No Priors podcast, March 2026

Garry 听到 Karpathy 这番话后，想知道"怎么做到的"——如何一个人像二十个人的团队一样高效。

### 1.2 数据对比

| 指标 | 2013 (Bookface) | 2026 (gstack) |
|------|-----------------|---------------|
| GitHub contributions | 772 | 1,237+ |
| 编程方式 | 纯手工 | AI Agent + gstack |
| 日均产出 | ~10行 | 10,000-20,000行 |

**60天统计：** 600,000+ 行生产代码（35% 测试），部分时间 + 兼职运营 YC。

---

## 2. 核心问题与解决方案

### 2.1 传统 AI 编程的困境

| 困境 | 表现 |
|------|------|
| 无状态 | 每次命令都重新启动，丢失上下文 |
| 无专业分工 | 一个 AI 回答所有问题，不够深入 |
| 无质量门禁 | 代码审查靠人工，容易遗漏 |
| 无发布流程 | 代码写完就结束，没有自动化 |

### 2.2 gstack 的解决方案

**gstack 把 Claude Code 变成虚拟工程团队：**

| 虚拟角色 | gstack 技能 |
|----------|-------------|
| CEO / 创始人 | `/plan-ceo-review` |
| 工程经理 | `/plan-eng-review`, `/review` |
| 设计师 | `/plan-design-review`, `/design-review` |
| QA 主管 | `/qa` |
| 安全官 | `/cso` |
| 发行工程师 | `/ship`, `/land-and-deploy` |
| 技术文档工程师 | `/document-release` |

### 2.3 核心比喻

> gstack 是**交响乐团指挥家**：你不亲自演奏，而是指挥各个乐手（AI 技能）各司其职。

**关键理解：** 用户不需要懂 CDP 协议、SQL 注入原理——只要会说 `/review`，专业的事情交给专业技能。

---

## 3. 核心功能全景

### 3.1 技能分类（23个技能）

#### 规划阶段
| 技能 | 功能 |
|------|------|
| `/office-hours` | YC 风格的六问法，重构产品想法 |
| `/plan-ceo-review` | CEO 视角审查，找到10星产品 |
| `/plan-eng-review` | 工程视角，锁定架构、数据流、测试 |
| `/plan-design-review` | 设计视角，评分+改进建议 |
| `/plan-devex-review` | 开发者体验审查 |

#### 构建阶段
| 技能 | 功能 |
|------|------|
| `/autoplan` | 自动运行 CEO→设计→工程的完整审查 |
| `/design-consultation` | 从零构建设计系统 |
| `/design-shotgun` | 多设计变体对比 |
| `/design-html` | 生产级 HTML 生成 |

#### 审查阶段
| 技能 | 功能 |
|------|------|
| `/review` | 代码审查，找 CI 测不出的 bug |
| `/investigate` | 系统性调试 |
| `/devex-review` | 真实开发者体验审计 |
| `/codex` | 第二意见（Codex 独立审查） |

#### 测试阶段
| 技能 | 功能 |
|------|------|
| `/qa` | 真浏览器测试+修复+回归测试 |
| `/qa-only` | 仅报告 bug，不改代码 |
| `/benchmark` | 性能基准测试 |
| `/canary` | 部署后监控 |

#### 发布阶段
| 技能 | 功能 |
|------|------|
| `/ship` | 同步+测试+推送+PR |
| `/land-and-deploy` | 合并+等待+验证生产 |
| `/document-release` | 自动更新文档 |

#### 浏览器相关
| 技能 | 功能 |
|------|------|
| `/browse` | 无头浏览器，~100ms/命令 |
| `/open-gstack-browser` | 带侧边栏的完整浏览器 |
| `/setup-browser-cookies` | 导入真实浏览器 Cookie |

#### 工具类
| 技能 | 功能 |
|------|------|
| `/retro` | 每周回顾 |
| `/learn` | 跨会话记忆管理 |
| `/careful` | 破坏性命令警告 |
| `/freeze` | 目录编辑锁定 |
| `/guard` | careful + freeze |
| `/unfreeze` | 解除锁定 |
| `/gstack-upgrade` | 自动升级 |

### 3.2 工具类（8个）

| 工具 | 功能 |
|------|------|
| `/codex` | 第二意见审查 |
| `/careful` | 安全护栏 |
| `/freeze` | 编辑锁定 |
| `/guard` | 完整安全 |
| `/unfreeze` | 解锁 |
| `/open-gstack-browser` | 浏览器+侧边栏 |
| `/setup-deploy` | 部署配置 |
| `/gstack-upgrade` | 自升级 |

---

## 4. 典型工作流

### 4.1 从想法到发布

```
想法 → /office-hours → /plan-ceo-review → /plan-eng-review
     → 写代码
     → /review → /qa → /ship → /land-and-deploy
     → /document-release → /retro
```

### 4.2 具体示例

> 用户："I want to build a daily briefing app for my calendar."

1. **/office-hours** → AI 发现用户实际需要的是"个人首席助理 AI"，不是"日历应用"
2. **/plan-ceo-review** → 挑战范围，生成3种实现方案
3. **/plan-eng-review** → 锁定架构、测试计划、安全考虑
4. **/review** → 自动修复2个问题，询问1个竞态条件
5. **/qa** → 打开真实浏览器，发现并修复1个 bug
6. **/ship** → 测试从42增加到51，新增9个

**关键洞察：** 用户说"日历应用"，AI 说"你在构建首席助理 AI"——因为 AI 倾听的是痛点，不是功能请求。

---

## 5. 安装与部署

### 5.1 30秒安装

```bash
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup
```

### 5.2 多 Agent 支持

gstack 不只是 Claude Code 的工具，支持 8 种 AI 编程工具：

| Agent | 配置路径 |
|-------|----------|
| Claude Code | `~/.claude/skills/` |
| OpenAI Codex CLI | `~/.codex/skills/` |
| Cursor | `~/.cursor/skills/` |
| OpenCode | `~/.config/opencode/skills/` |
| Factory Droid | `~/.factory/skills/` |
| Slate | `~/.slate/skills/` |
| Kiro | `~/.kiro/skills/` |
| OpenClaw | 特定配置 |

---

## 6. 架构特点

### 6.1 设计原则

| 原则 | 实现 |
|------|------|
| 无状态协调 | 文件系统是状态，Agent 无状态 |
| Markdown 即配置 | SKILL.md 是 prompt，`.tmpl` 是模板 |
| 零侵入 | 安装到 `~/.claude/`，不污染 PATH |
| 自动生成 | 文档从模板生成，永不过时 |

### 6.2 与传统工具的区别

| 维度 | 传统工具 | gstack |
|------|----------|--------|
| 定位 | 工具集合 | 流程编排 |
| 扩展方式 | 插件 API | Markdown 模板 |
| 状态管理 | 内存/数据库 | 文件系统 |
| Agent 支持 | 单一 | 多 Agent |

---

## 7. 研究结论

### 7.1 gstack 的本质

gstack 是一个 **AI 工程流程编排框架**，而不是简单的工具集合。它的核心价值：

1. **专业化分工**：23个技能 = 23个专业角色
2. **流程编排**：技能之间有数据流和依赖关系
3. **质量门禁**：每个阶段都有审查点
4. **零记忆负担**：用户不需要记住流程，技能自己知道下一步

### 7.2 目标读者分析

| 读者类型 | gstack 如何帮助 |
|----------|-----------------|
| 创业者/CEO | 保持技术视野，高效审查代码 |
| Claude Code 新手 | 从空白提示 → 结构化流程 |
| Tech Lead | 严谨审查+自动化发布 |

### 7.3 值得深入的技术点

1. SKILL.md 模板系统（ch04）
2. 浏览器持久化架构（ch03）
3. Host 适配层设计（ch07-ch08）
4. 安全机制（ch09）
5. 构建与发布（ch10）

---

## 8. 源码位置

| 文件 | 内容 |
|------|------|
| `README.md` | 项目介绍、愿景 |
| `AGENTS.md` | 技能列表 |
| `SKILL.md` | gstack 技能入口 |

<!-- RESEARCH_COMPLETE -->
