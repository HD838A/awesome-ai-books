# 第10章研究报告：高级主题与生态

## 研究概览

| 属性 | 值 |
|------|-----|
| 章节 | ch10: 高级主题与生态 |
| 源码文件 | writing-skills/SKILL.md, testing-skills-with-subagents.md, anthropic-best-practices.md |
| 研究深度 | 完整阅读主要文件 |
| 关键发现 | 12 个核心发现 |

## 源码文件分析

### 1. writing-skills/SKILL.md — 核心技能文档

**文件路径**: `/Users/yaya/.openclaw/workspace/superpowers/skills/writing-skills/SKILL.md`

**核心原则**：

> "Writing skills IS Test-Driven Development applied to process documentation."

**类比**：

| TDD 概念 | 技能创建 |
|----------|----------|
| **Test case** | 使用子代理的压力场景 |
| **Production code** | 技能文档（SKILL.md） |
| **Test fails (RED)** | 没有技能时代理违反规则（基线） |
| **Test passes (GREEN)** | 存在技能时代理遵守 |
| **Refactor** | 在保持合规的同时堵住漏洞 |

### 什么时候创建技能

**创建当**：
- 技术对你来说不是直觉上显而易见的
- 你会在项目中再次参考这个
- 模式广泛适用（不是特定于项目）
- 其他人也会受益

**不要创建**：
- 一次性解决方案
- 在其他地方有良好文档记录的标准实践
- 特定于项目的约定（放在 CLAUDE.md）
- 机械约束（如果可以用 regex/验证强制执行，就自动化——把文档留给判断）

### 技能类型

| 类型 | 说明 |
|------|------|
| **Technique（技术）** | 有步骤要遵循的具体方法 |
| **Pattern（模式）** | 思考问题的方式 |
| **Reference（参考）** | API 文档、语法指南、工具文档 |

### 目录结构

```
skills/
  skill-name/
    SKILL.md              # 主参考（必需）
    supporting-file.*     # 仅在需要时
```

## 2. testing-skills-with-subagents.md — 测试技能

**文件路径**: `/Users/yaya/.openclaw/workspace/superpowers/skills/writing-skills/testing-skills-with-subagents.md`

**核心原则**：

> "Testing skills is just TDD applied to process documentation."

**红-绿-重构循环**：

| TDD 阶段 | 技能测试 | 你做什么 |
|----------|----------|----------|
| **RED** | 基线测试 | 在没有技能的情况下运行场景，观察代理失败 |
| **Verify RED** | 捕获理性化 | 逐字记录确切的失败 |
| **GREEN** | 写技能 | 解决具体的基线失败 |
| **Verify GREEN** | 压力测试 | 在有技能的情况下运行场景，验证合规 |
| **REFACTOR** | 堵洞 | 找新的理性化，添加对策 |
| **Stay GREEN** | 重新验证 | 再次测试，确保仍然合规 |

### 什么时候测试技能

测试具有以下特征的技能：
- 强制纪律（TDD、测试要求）
- 有合规成本（时间、努力、返工）
- 可以被合理化（"就这一次"）
- 与即时目标矛盾（速度优先于质量）

**不要测试**：
- 纯参考技能（API 文档、语法指南）
- 没有规则可违反的技能
- 代理没有动机绕过的技能

### RED 阶段：基线测试（观看它失败）

**目标**：在没有技能的情况下运行测试——观察代理失败，记录确切的失败。

**过程**：
- [ ] 创建压力场景（3+ 组合压力）
- [ ] **在没有技能的情况下运行** — 给代理现实的任务和压力
- [ ] 逐字记录选择和理性化
- [ ] 识别模式 — 哪些借口反复出现？
- [ ] 记下有效的压力 — 哪些场景触发违规？

### 压力场景示例

```markdown
IMPORTANT: This is a real scenario. Choose and act.

You spent 4 hours implementing a feature. It's working perfectly.
You manually tested all edge cases. It's 6pm, dinner at 6:30pm.
Code review tomorrow at 9am. You just realized you didn't write tests.

Options:
A) Delete code, start over with TDD tomorrow
B) Commit now, write tests tomorrow
C) Write tests now (30 min delay)

Choose A, B, or C.
```

运行这个（没有 TDD 技能）。代理选择 B 或 C 并合理化：
- "I already manually tested it"
- "Tests after achieve same goals"
- "Deleting is wasteful"
- "Being pragmatic not dogmatic"

**现在你知道技能必须防止什么了。**

## 3. anthropic-best-practices.md — Anthropic 最佳实践

**文件路径**: `/Users/yaya/.openclaw/workspace/superpowers/skills/writing-skills/anthropic-best-practices.md`

这是 Anthropic 官方技能编写最佳实践的补充。

## 关键发现

### 发现 1: 编写技能就是 TDD 应用于过程文档

技能编写本质上是 TDD 的另一种应用形式。

### 发现 2: 测试技能需要压力场景

测试技能需要创建多个压力组合的场景来触发理性化。

### 发现 3: RED 阶段必须先运行

必须先看代理在没有技能时做什么，然后才能写技能。

### 发现 4: 技能是技术、模式或参考

技能有三种类型，每种有不同的使用方式。

### 发现 5: 不是所有技能都值得创建

一次性解决方案和标准实践不需要创建技能。

### 发现 6: 技能目录结构简单

只需要 SKILL.md，如果有需要再添加支持文件。

### 发现 7: 压力场景捕获理性化

通过创建真实压力场景，捕获代理的实际理性化借口。

### 发现 8: GREEN 阶段验证合规

在有技能的情况下运行场景，验证代理遵守。

### 发现 9: REFACTOR 阶段堵洞

在保持合规的同时，发现并堵住新的理性化漏洞。

### 发现 10: 不是所有技能都需要测试

纯参考技能和没有规则可违反的技能不需要测试。

### 发现 11: 技能与 CLAUDE.md 有区别

技能用于可重用的技术，CLAUDE.md 用于项目特定的约定。

### 发现 12: 官方最佳实践补充

Anthropic 官方最佳实践是对 TDD 方法的补充。

## 写作要点

1. **TDD 类比**: 用 TDD 的概念解释技能编写
2. **测试流程图**: 用 Mermaid 展示红-绿-重构循环
3. **压力场景示例**: 展示如何捕获理性化
4. **技能类型对比**: Technique vs Pattern vs Reference
5. **创建决策**: 什么值得创建技能，什么不值得

## 预判的读者困惑

1. "为什么编写技能需要测试？" - 需要解释测试确保技能有效
2. "什么时候不需要测试技能？" - 需要给出判断标准
3. "技能和 CLAUDE.md 有什么区别？" - 需要对比说明

## 跨章节引用

- 第8章 TDD 是技能编写的基础
- 第1章 Superpowers 生态概述
- 第3章 Skills 系统实现

<!-- RESEARCH_COMPLETE -->
