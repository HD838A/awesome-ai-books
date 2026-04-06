# 附录：快速参考

> 本附录提供 Superpowers 的快速参考指南，包括核心规则、常用技能速查表和工具映射。

## A.1 核心规则速查

### 铁律汇总

| 技能 | 铁律 |
|------|------|
| **Brainstorming** | 没有设计批准就不能实现 |
| **Systematic Debugging** | 没有根因调查就不能修复 |
| **TDD** | 没有失败的测试就不能写代码 |
| **Subagent-Driven Development** | 没有两阶段审查就不能交付 |

### RED FLAGS（通用）

以下想法意味着你在合理化——**停止并检查技能**：

- "这只是简单的问题"
- "我需要先获取更多上下文"
- "让我先探索代码库"
- "这不需要正式技能"
- "我会先做这一件事"
- "我已经手动测试了"
- "就这一次"
- "保留作为参考"

## A.2 技能速查表

### Brainstorming 技能

**使用场景**：任何实现任务之前

**9 步检查清单**：
1. ✅ 探索项目上下文
2. ✅ 提供视觉伴侣（可选）
3. ✅ 提出澄清问题
4. ✅ 提出 2-3 个方案
5. ✅ 呈现设计方案
6. ✅ 编写设计文档
7. ✅ 规范自审
8. ✅ 用户审阅书面规范
9. ✅ 过渡到 writing-plans

**输出**：`docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`

---

### Systematic Debugging 技能

**使用场景**：遇到任何 bug、测试失败或意外行为

**4 阶段流程**：
1. 🔍 根本原因调查
2. 📊 模式分析
3. 🧪 假设与测试
4. ✅ 验证

**关键原则**：
- 没有调查就不能修复
- 没有数据就不要猜测
- 在源头修复，而不是症状

---

### TDD 技能

**使用场景**：实现任何功能或 bug 修复

**红-绿-重构循环**：
```
🔴 RED → ✅ GREEN → 🔵 REFACTOR → 🔴 RED
```

**验证清单**：
- [ ] 每个新函数/方法都有测试
- [ ] 在实现之前观看每个测试失败
- [ ] 写最小代码来通过每个测试
- [ ] 所有测试通过
- [ ] 输出干净（无错误、无警告）

---

### Subagent-Driven Development 技能

**使用场景**：执行实现计划中的独立任务

**两阶段审查**：
1. 规范合规审查（先做）
2. 代码质量审查（后做）

**实现者状态**：
| 状态 | 处理 |
|------|------|
| DONE | 进入规范合规审查 |
| DONE_WITH_CONCERNS | 阅读疑虑，决定是否处理 |
| NEEDS_CONTEXT | 提供缺失上下文并重新分配 |
| BLOCKED | 评估原因，采取相应措施 |

---

### Writing Plans 技能

**使用场景**：规范批准后，创建实现计划

**计划结构**：
```markdown
# [Feature] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development

**Goal:** [一句话]

**Architecture:** [2-3 句]

---

### Task N: [组件名]

- [ ] Step 1: Write failing test
- [ ] Step 2: Run test (verify fails)
- [ ] Step 3: Write minimal code
- [ ] Step 4: Run test (verify passes)
- [ ] Step 5: Commit
```

**输出**：`docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`

---

### Receiving Code Review 技能

**响应模式**：
```
1. READ: Complete feedback without reacting
2. UNDERSTAND: Restate in own words
3. VERIFY: Check against codebase reality
4. EVALUATE: Technically sound?
5. RESPOND: Technical acknowledgment or pushback
6. IMPLEMENT: One at a time, test each
```

**禁止响应**：
- ❌ "You're absolutely right!"
- ❌ "Great point!"
- ❌ "Let me implement that now"

---

### Finishing a Development Branch 技能

**完成流程**：
1. 验证测试通过
2. 确定基础分支
3. 呈现 4 个选项
4. 执行选择
5. 清理

**4 个选项**：
1. 本地合并
2. 创建 Pull Request
3. 保留分支
4. 丢弃工作

---

### Using Superpowers 技能

**1% 规则**：只要有 1% 的可能性技能适用，就必须检查。

**技能优先级**：
1. 流程技能（brainstorming、debugging）
2. 实现技能（frontend-design、mcp-builder）

---

### Writing Skills 技能

**技能类型**：
| 类型 | 说明 | 示例 |
|------|------|------|
| Technique | 有步骤的具体方法 | condition-based-waiting |
| Pattern | 思考问题的方式 | flatten-with-flags |
| Reference | API 文档 | office docs |

**TDD 用于技能编写**：
1. 🔴 RED：基线测试（无技能时观察失败）
2. ✅ GREEN：编写技能（针对失败）
3. 🔵 REFACTOR：堵洞（保持合规）

## A.3 工具映射

### Claude Code → Copilot CLI

| Claude Code | Copilot CLI | 用途 |
|-------------|-------------|------|
| `Read` | `view` | 读取文件 |
| `Write` | `create` | 创建文件 |
| `Edit` | `edit` | 编辑文件 |
| `Bash` | `bash` | 运行命令 |
| `Grep` | `grep` | 搜索 |
| `Glob` | `glob` | 查找文件 |
| `Skill` | `skill` | 调用技能 |
| `Task` | `task` | 分派子代理 |
| `TodoWrite` | `sql` + `todos` | 任务跟踪 |

## A.4 文件命名规范

| 文件类型 | 命名规范 | 示例 |
|----------|----------|------|
| 规范 | `YYYY-MM-DD-<topic>-design.md` | `2026-04-06-login-design.md` |
| 计划 | `YYYY-MM-DD-<feature-name>.md` | `2026-04-06-user-auth.md` |
| 技能 | `SKILL.md` | `brainstorming/SKILL.md` |

## A.5 原则速查

| 缩写 | 全称 | 说明 |
|------|------|------|
| YAGNI | You Aren't Gonna Need It | 不要添加不需要的功能 |
| DRY | Don't Repeat Yourself | 不要重复知识 |
| TDD | Test-Driven Development | 测试驱动开发 |
| HARD-GATE | - | 没有批准就不能前进 |
| RED FLAGS | - | 识别理性化的信号 |

## A.6 工作流概览

```mermaid
flowchart TD
    A["用户请求"] --> B["brainstorming"]
    B --> C["规范文档"]
    C --> D["writing-plans"]
    D --> E["实现计划"]
    E --> F{"有子代理?"}
    F -->|"是"| G["subagent-driven-development"]
    F -->|"否"| H["executing-plans"]
    G --> I["两阶段审查"]
    H --> I
    I --> J["finishing-a-development-branch"]
    J --> K["完成"]
    
    E -.->|"bug| L["systematic-debugging"]
    L -.-> M["根因"]
    
    subgraph "TDD 循环"
    N["🔴 RED"] --> O["✅ GREEN"]
    O --> P["🔵 REFACTOR"]
    P --> N
    end
```

---

**祝你在 Superpowers 的使用中取得成功！**

<!-- DRAFT_COMPLETE -->
