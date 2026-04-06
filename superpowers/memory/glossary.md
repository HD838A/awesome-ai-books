# Superpowers 源码解析：AI 编程助手的超能力框架 术语表

## 使用说明

- 📌 **保留英文** 的术语在正文中直接使用英文原文
- 🔄 **翻译术语** 首次出现时格式为：中文翻译（English Original）
- ⚠️ 新增术语必须在本表中注册后才能在正文中使用
- 🔍 按英文字母排序，便于快速查找

## 术语总表

| 英文术语 | 中文翻译 | 首次出现 | 定义 | 注意事项 |
|----------|----------|----------|------|----------|
| Agent | —（保留英文） | ch1 | 在 AI 编程助手中的执行单元，可以理解为一个能够独立完成特定任务的 AI 实例。 | 注意区分：Agent 是一种角色定义，不是具体的代码实现 |
| bootstrap | 引导（保留英文更常见） | ch2 | 程序启动时的初始化过程。Superpowers 中的 bootstrap 负责将 Skills 系统注入到 AI 助手的上下文中。 | 不要与"boot"混淆，bootstrap 是完整的初始化过程 |
| Bootstrap | 大写引导上下文 | ch1 | Superpowers 特有的上下文注入机制。会话启动时，Bootstrap 内容被包装在 `<EXTREMELY_IMPORTANT>` 标签中，告知 AI 已安装 Superpowers 和核心规则。 | 与小写 bootstrap（通用初始化）区分，Bootstrap 是 Superpowers 的专有概念 |
| brainwriting | —（保留英文） | ch4 | 一种协作技术，通过书面而非口头方式进行头脑风暴，适合 AI 辅助的异步工作场景。 | 与"brainstorming"（头脑风暴）不同，brainwriting 强调书面化 |
| brainstorming | 头脑风暴 | ch1 | Superpowers 的核心技能之一，通过结构化对话帮助用户明确需求并形成设计规范。 | 本书中专指 Superpowers 的 brainstorming 技能，不是通用意义上的讨论 |
| CLI | Command Line Interface | ch1 | 命令行界面，即通过文本命令与程序交互的方式。 | GitHub Copilot CLI、Claude CLI 等都提供 CLI 接口 |
| context | 上下文 | ch2 | AI 对话中包含的所有信息，包括对话历史、项目文件、系统提示等。上下文决定了 AI 能"看到"什么。 | 在 Superpowers 中，context injection（上下文注入）是核心机制 |
| frontmatter | 元数据头（保留英文更常见） | ch3 | YAML 格式的文件头部元数据，用于定义 Skill 的名称、描述等属性。 | 常见于 Markdown 文件开头的 `---` 包裹区域 |
| HARD-GATE | —（保留英文） | ch4 | Superpowers brainstorming 技能中的硬性规则：在用户批准设计之前，绝对不能开始实现。 | 注意这不是"建议"而是"规则"，跳过 HARD-GATE 会导致工作流失效 |
| Hook | —（保留英文） | ch2 | 在特定事件发生时自动执行的脚本或代码。Superpowers 通过 Hook 在会话启动时注入上下文。 | 在 Web 开发中也指"钩子函数"，但在本书中特指会话/事件 Hook |
| Markdown | —（保留英文） | ch1 | 一种轻量级标记语言，常用于文档编写。Skill 文件使用 Markdown 格式。 | Superpowers 的 Skill 文件本质上都是 Markdown 文件 |
| marketplace | 应用市场 | ch1 | AI 编程助手的插件分发平台，如 Claude Code Plugin Marketplace。 | 注意不要与"应用商店（App Store）"混淆 |
| mermaid | —（保留英文） | ch3 | 一种基于文本的图表绘制工具，支持流程图、时序图等多种图表类型。 | 注意是小写，常见于 Markdown 中嵌入图表 |
| meta-skill | 元技能 | ch3 | 关于技能的技能。writing-skills 就是一种元技能，用于指导如何编写其他 Skill。 | 元技能是 Superpowers 框架的自我描述能力 |
| parallel dispatch | 并行调度 | ch6 | 同时启动多个子代理执行任务的工作模式，可以提高效率但需要处理好依赖关系。 | 注意与"顺序执行"对比，并行调度不保证完成顺序 |
| platform adapter | 平台适配层 | ch2 | Superpowers 架构中负责处理不同 AI 编程助手平台差异的模块。 | 这是 Superpowers 能支持多平台的关键 |
| plugin | 插件 | ch1 | 可扩展 AI 编程助手功能的模块化组件。Superpowers 本身就是一个插件。 | 注意区分：plugin 是功能单元，Skill 是技能定义 |
| prompt | 提示词 | ch2 | 给 AI 的指令或上下文信息。Superpowers 通过注入 prompt 来引导 AI 行为。 | 不要与"命令（command）"混淆，prompt 可以包含上下文、示例、约束等 |
| self-review | 自我审查 | ch5 | 子代理在完成任务后对自己的工作进行检查，确保符合规范。 | Superpowers 要求子代理在提交前进行自我审查 |
| skill | 技能 | ch1 | Superpowers 中的核心功能单元，每个 Skill 定义了一种特定的工作方式或最佳实践。 | 注意：skill 是小写，而 Skill 有特定含义（Superpowers 的技能文件） |
| subagent | 子代理 | ch5 | 由主会话启动的独立 AI 实例，有自己的上下文，专门负责特定任务。 | subagent 是 Superpowers 实现任务隔离和并行处理的关键机制 |
| subagent-driven development | 子代理驱动开发 | ch1 | Superpowers 的核心开发方法论，通过子代理分工和两阶段审查实现高质量代码。 | 这是 Superpowers 与其他 AI 辅助工具的核心差异 |
| systematic debugging | 系统化调试 | ch7 | 一种调试方法论，强调通过系统性的步骤（而非随机尝试）来定位和解决问题。 | 不要与"暴力调试"（盲目修改代码尝试）混淆 |
| TDD | Test-Driven Development | ch8 | 测试驱动开发，先写测试再写实现的工作方式。 | TDD 是 Superpowers 强调的工程实践之一 |
| template | 模板 | ch2 | 预定义的结构或格式，用于生成一致性输出。Superpowers 使用模板来规范 Skill 编写。 | 注意区分文档模板和代码模板 |
| tool mapping | 工具映射 | ch9 | 将不同 AI 平台的工具名称对应到统一概念的工作，如 TodoWrite → todowrite。 | 这是实现跨平台兼容的关键 |
| two-stage review | 两阶段审查 | ch5 | Subagent-Driven Development 中的审查模式：先由 Spec Reviewer 检查规范符合性，再由 Code Quality Reviewer 检查代码质量。 | 这个顺序很重要：先确保"做对的事"，再确保"把事做对" |
| worktree | Git 工作树 | ch10 | Git 的功能，允许你在同一个仓库的不同目录中同时工作在多个分支上。 | using-git-worktrees 技能帮助你在多分支并行工作时保持清晰 |

## 缩写表

| 缩写 | 全称 | 中文 |
|------|------|------|
| API | Application Programming Interface | 应用程序接口 |
| AST | Abstract Syntax Tree | 抽象语法树 |
| CLI | Command Line Interface | 命令行接口 |
| GUI | Graphical User Interface | 图形用户界面 |
| IDE | Integrated Development Environment | 集成开发环境 |
| JSON | JavaScript Object Notation | JavaScript 对象表示法 |
| LLM | Large Language Model | 大语言模型 |
| MCP | Model Context Protocol | 模型上下文协议 |
| PR | Pull Request | 拉取请求 |
| SDK | Software Development Kit | 软件开发工具包 |
| TDD | Test-Driven Development | 测试驱动开发 |
| YAML | YAML Ain't Markup Language | YAML 不是标记语言 |

## 术语决策记录

### Skill vs skill

- **候选翻译**: 技能 / 能力
- **最终选择**: 保留 "Skill" 作为专有名词
- **理由**: Skill 在 Superpowers 中是一个特定的技术概念，与通用的"技能"含义不同。保留英文首字母大写形式有助于区分
- **参考**: Superpowers 官方文档中始终使用 "Skill" 作为专有名词

### subagent vs Agent

- **候选翻译**: 子代理 / 分代理 / 副代理
- **最终选择**: 子代理
- **理由**: "子代理"最直观地表达了嵌套关系（主会话 → 子代理）
- **参考**: AI 编程领域的常见用法

### HARD-GATE

- **处理方式**: 保留英文，不翻译
- **理由**: 这是 Superpowers 特有的专有名词，翻译会丧失其专业性和品牌识别度
- **首次出现时**: 用中文解释其含义（HARD-GATE：硬性门槛，在设计被批准前绝对不能开始实现）
