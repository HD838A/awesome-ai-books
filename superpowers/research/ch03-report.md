# 第3章研究报告：Skills 系统实现

## 研究概览

| 属性 | 值 |
|------|-----|
| 章节 | ch03: Skills 系统实现 |
| 源码文件 | writing-skills/SKILL.md, anthropic-best-practices.md, writing-skills/*.md |
| 研究深度 | 完整阅读 Skill 编写指南及相关文档 |
| 关键发现 | 11 个核心发现 |

## 源码文件分析

### 1. writing-skills/SKILL.md — 核心技能编写指南

**文件路径**: `/Users/yaya/.openclaw/workspace/superpowers/skills/writing-skills/SKILL.md`

**核心原则**: "Writing skills IS Test-Driven Development applied to process documentation."

**TDD 映射**:

| TDD 概念 | Skill 编写 |
|-----------|------------|
| 测试用例 | 压力场景 + 子代理 |
| 生产代码 | Skill 文档 (SKILL.md) |
| 测试失败 (RED) | 无 Skill 时 Agent 违反规则 |
| 测试通过 (GREEN) | 有 Skill 时 Agent 遵守 |
| 重构 | 在保持合规的同时堵住漏洞 |

**Skill 类型**:

1. **Technique（技术）** - 有具体步骤的方法（如 condition-based-waiting）
2. **Pattern（模式）** - 思考问题的方式（如 flatten-with-flags）
3. **Reference（参考）** - API 文档、语法指南（如 office docs）

**SKILL.md 结构**:

```markdown
---
name: skill-name
description: Use when [触发条件]
---

# Skill Name

## Overview
核心原则 1-2 句话

## When to Use
症状和使用场景列表

## Core Pattern
Before/after 代码对比

## Quick Reference
快速查阅的表格或列表

## Implementation
内联代码或文件链接

## Common Mistakes
常见错误 + 修复方法
```

### 2. Frontmatter 规范

**必需字段**:
- `name`: 字母、数字、连字符（无括号、特殊字符）
- `description`: 第三人称，**只描述何时使用**（不是做什么）

**描述陷阱**:

```yaml
# ❌ 错误：总结工作流 - Agent 可能按描述执行而非阅读完整内容
description: Use when executing plans - dispatches subagent per task with code review

# ✅ 正确：只描述触发条件
description: Use when executing implementation plans with independent tasks
```

**为什么描述不能总结工作流**:
测试发现，当描述总结工作流时，Agent 可能跟随描述执行而非阅读完整的 Skill 内容。

### 3. Claude Search Optimization (CSO)

**三个核心策略**:

1. **丰富的描述字段** - 描述触发条件而非工作流
2. **关键词覆盖** - 使用 Agent 会搜索的词
3. **描述性命名** - 主动语态，动词优先

**命名规范**:
- ✅ `creating-skills` (动词-ing)
- ✅ `condition-based-waiting` (动名词短语)
- ❌ `skill-creation` (名词短语)

**Token 效率目标**:
- getting-started 工作流: <150 词
- 频繁加载的 Skill: <200 词
- 其他 Skill: <500 词

### 4. 测试方法论

**测试不同 Skill 类型**:

| Skill 类型 | 测试方法 | 成功标准 |
|------------|----------|----------|
| Discipline-Enforcing | 学术问题 + 压力场景 | Agent 在最大压力下遵守规则 |
| Technique | 应用场景 + 边界情况 | Agent 正确应用技术 |
| Pattern | 识别 + 应用 + 反例 | Agent 正确识别何时/如何使用 |
| Reference | 检索 + 应用 | Agent 正确找到和应用参考信息 |

**铁律**: "NO SKILL WITHOUT A FAILING TEST FIRST"

### 5. 防止合理化

**Agent 会合理化的原因**:
- 聪明的 Agent 会找到漏洞
- 压力下更容易跳过规则
- 需要显式禁止具体绕过方式

**防止合理化策略**:

1. **关闭每个漏洞** - 不仅陈述规则，还禁止具体绕过方式
2. **解决"精神 vs 字面"争论** - 在开头添加基本原则
3. **构建合理化表格** - 捕获测试中的 Agent 借口
4. **创建 Red Flags 列表** - 让 Agent 自我检查

**Red Flags 示例**:

| 想法 | 真相 |
|------|------|
| "这只是简单问题" | 问题也是任务，检查 Skills |
| "我就先做这一件事" | 先检查再做 |
| "我记得这个 Skill" | Skill 在演进，用当前版本 |
| "这个不需要正式 Skill" | Skill 存在就要用 |

### 6. anthropic-best-practices.md — Anthropic 官方最佳实践

**核心原则**:

1. **简洁是关键** - Context window 是公共资源
2. **设定适当的自由度** - 匹配任务的脆弱性和可变性
3. **使用流程图的条件**:
   - ✅ 非显而易见的决策点
   - ✅ Agent 可能过早停止的循环
   - ✅ "何时使用 A vs B" 的决策
   - ❌ 参考材料 → 用表格、列表
   - ❌ 代码示例 → Markdown 块
   - ❌ 线性指令 → 编号列表

### 7. persuasion-principles.md — 说服原理

**基于研究的原则** (Cialdini, 2021; Meincke et al., 2025):

1. **权威原则** - 引用来源、专家意见
2. **承诺与一致性** - 让 Agent 做出承诺
3. **稀缺性** - 强调机会难得
4. **社会认同** - 说明其他人也在这样做
5. **相似性/Unity** - 强调共同身份

### 8. graphviz-conventions.dot — 图形约定

**Mermaid 语法要点**:
- 含空格/中文的标签加引号: `"节点["内容"]"`
- 多行用 `<br/>`
- 节点 ID 只用英文/数字
- 不支持 `**bold**`

## 关键发现

### 发现 1: Skills 是"行为代码"

Skills 不是普通文档，而是"塑造 Agent 行为的代码"。这意味着：
- 修改 Skills 需要测试，就像修改代码一样
- 评估标准是"Agent 行为改变"而非"文档清晰"
- 这是 Superpowers 与其他文档系统的根本区别

### 发现 2: 描述字段的陷阱

描述字段总结工作流会导致 Agent 跳过 Skill 内容。这是一个微妙的陷阱：
- 看起来更方便
- 实际上破坏了 Skill 的设计意图
- 必须明确禁止这种用法

### 发现 3: 铁律的绝对性

"NO SKILL WITHOUT A FAILING TEST FIRST" 是绝对规则，没有例外：
- 不是"简单添加"就例外
- 不是"文档更新"就例外
- 违反 = 删除，从头开始

### 发现 4: TDD 应用于文档

Skills 编写本质上是将 TDD 应用于文档：
- 先运行基线测试（看 Agent 怎么失败）
- 再写 Skill（堵住漏洞）
- 再测试（看 Agent 是否遵守）
- 重构（改进 Skill 而不破坏合规）

### 发现 5: Token 效率压力

Context window 是稀缺资源，所以：
- 所有 Skill 都有 Token 目标
- 频繁加载的 Skill 必须 <200 词
- 使用交叉引用而非重复内容

### 发现 6: 防止合理化的系统性方法

Superpowers 使用多种策略防止 Agent 合理化：
- Red Flags 列表
- 合理化表格
- 明确禁止绕过方式
- 精神 vs 字面的基本原则

### 发现 7: 流程图的使用条件

流程图只在特定情况下使用：
- 决策点不直观时
- Agent 可能过早停止时
- 需要说明何时用 A vs B 时

### 发现 8: 元技能的概念

writing-skills 是一个元技能——关于技能的技能。这展示了 Superpowers 的自我描述能力：
- 用 Skill 来描述如何编写 Skill
- 用 TDD 来描述如何为 Skill 写测试

### 发现 9: Skill 目录结构规范

```
skills/
  skill-name/
    SKILL.md              # 主参考（必需）
    supporting-file.*     # 仅在需要时
```

**平展命名空间** - 所有 Skill 在一个可搜索的命名空间中

### 发现 10: 测试场景的设计

测试 Skill 需要精心设计的场景：
- 压力场景（Agent 疲惫或赶时间时）
- 组合压力（时间 + 沉没成本 + 疲惫）
- 识别合理化（记录 Agent 的借口）

### 发现 11: 与 Anthropic 官方指南的关系

Superpowers 的 Skill 编写方法与 Anthropic 官方指南有所不同：
- 更强调测试
- 更强调防止合理化
- 更强调 Token 效率

CLAUDE.md 中明确说明：不符合 Superpowers 哲学的"合规"修改不会被接受。

## 写作要点

1. **Skill 是代码的概念**: 反复强调 Skills 是"行为塑造代码"，不是普通文档
2. **TDD 类比**: 用 TDD 的类比帮助读者理解 Skill 编写过程
3. **反例展示**: 展示什么是坏的 Skill 描述，什么是好的
4. **Token 效率**: 解释为什么 Token 效率重要
5. **合理化防止**: 展示防止 Agent 合理化的具体技术

## 预判的读者困惑

1. "为什么 Skill 需要测试？" - 需要解释 Skills 是行为代码
2. "描述不能总结工作流？" - 需要用具体反例说明
3. "Token 效率真的重要吗？" - 需要量化说明 context window 压力

## 跨章节引用

- 第5章（Subagent-Driven Development）会详细讲解子代理的使用
- 第8章（TDD）会详细讲解红-绿-重构循环
- 第7章（Debugging）会讲解防止合理化的具体技术

<!-- RESEARCH_COMPLETE -->
