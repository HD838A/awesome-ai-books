# gstack 源码地图

> 源码路径 → 书籍章节的映射关系

---

## ch01: gstack 是什么

| 源码文件/目录 | 章节用途 |
|---------------|----------|
| `README.md` | 项目介绍、愿景声明 |
| `AGENTS.md` | 技能列表总览 |
| `openclaw/gstack-*.md` | OpenClaw 集成说明 |

---

## ch02: 整体架构

| 源码文件/目录 | 章节用途 |
|---------------|----------|
| `ARCHITECTURE.md` | 架构设计文档（核心参考） |
| `browse/src/server.ts` | 守护进程服务器实现 |
| `browse/src/browser-manager.ts` | 浏览器生命周期管理 |
| `browse/src/config.ts` | 配置与状态文件读写 |
| `bin/gstack-*` | 二进制工具脚本 |

---

## ch03: 持久化浏览器

| 源码文件/目录 | 章节用途 |
|---------------|----------|
| `browse/src/commands.ts` | 浏览器命令实现 |
| `browse/src/snapshot.ts` | Ref 引用系统核心 |
| `browse/src/buffers.ts` | 环形日志缓冲区 |
| `browse/src/cookie-import-browser.ts` | Cookie 安全导入 |
| `browse/src/cdp-inspector.ts` | CDP 协议调试 |

---

## ch04: SKILL.md 模板系统

| 源码文件/目录 | 章节用途 |
|---------------|----------|
| `*/SKILL.md.tmpl` | 各技能模板（glob 匹配） |
| `scripts/gen-skill-docs.ts` | 模板生成器 |
| `scripts/dev-skill.ts` | 开发调试脚本 |

---

## ch05: 核心技能解析

| 源码文件/目录 | 章节用途 |
|---------------|----------|
| `plan-ceo-review/SKILL.md` | CEO 审查技能 |
| `plan-eng-review/SKILL.md` | 工程审查技能 |
| `plan-design-review/SKILL.md` | 设计审查技能 |
| `review/SKILL.md` | 代码审查技能 |
| `ship/SKILL.md` | 发布技能 |
| `qa/SKILL.md` | QA 测试技能 |

---

## ch06: 专业化审查流水线

| 源码文件/目录 | 章节用途 |
|---------------|----------|
| `autoplan/SKILL.md` | 自动审查编排 |
| `scripts/resolvers/review-army.ts` | 审查军团实现 |
| `scripts/resolvers/composition.ts` | 技能组合逻辑 |
| `scripts/resolvers/confidence.ts` | 置信度评估 |
| `review/specialists/*.md` | 专项审查清单 |

---

## ch07: Host 适配层

| 源码文件/目录 | 章节用途 |
|---------------|----------|
| `hosts/index.ts` | 主机配置注册表 |
| `hosts/claude.ts` | Claude 配置 |
| `hosts/codex.ts` | Codex 配置 |
| `hosts/cursor.ts` | Cursor 配置 |
| `hosts/*.ts` | 其他 Host 配置 |
| `scripts/host-config.ts` | Host 配置类型定义 |
| `scripts/host-adapters/*.ts` | 适配器实现 |

---

## ch08: 8大 AI 代理支持

| 源码文件/目录 | 章节用途 |
|---------------|----------|
| `hosts/factory.ts` | Factory Droid |
| `hosts/kiro.ts` | Kiro |
| `hosts/opencode.ts` | OpenCode |
| `hosts/slate.ts` | Slate |
| `hosts/openclaw.ts` | OpenClaw |
| `docs/ADDING_A_HOST.md` | 新增 Host 指南 |
| `openclaw/gstack-*.md` | OpenClaw 特定模板 |

---

## ch09: 安全机制

| 源码文件/目录 | 章节用途 |
|---------------|----------|
| `careful/SKILL.md` | 警告机制 |
| `freeze/SKILL.md` | 目录锁定 |
| `guard/SKILL.md` | 双重保护 |
| `freeze/bin/check-freeze.sh` | 冻结检查脚本 |

---

## ch10: 构建与发布

| 源码文件/目录 | 章节用途 |
|---------------|----------|
| `gstack-upgrade/SKILL.md` | 升级技能 |
| `gstack-upgrade/migrations/*.sh` | 数据库迁移 |
| `scripts/build-app.sh` | 构建脚本 |
| `bin/gstack-update-check` | 更新检查器 |
| `package.json` | 依赖与脚本定义 |
| `supabase/functions/*` | 云函数实现 |
| `setup` | 安装脚本 |

---

## 公共基础设施

| 源码文件/目录 | 用途 |
|---------------|------|
| `bin/gstack-config` | 配置管理 |
| `bin/gstack-telemetry-log` | 遥测日志 |
| `bin/gstack-slug` | 项目标识生成 |
| `scripts/resolvers/*.ts` | 共享解析器 |

