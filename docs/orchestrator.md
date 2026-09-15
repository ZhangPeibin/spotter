# Orchestrator 使用手册

Orchestrator 为 Codex 提供一套轻量的软件工作编排规则。主代理负责理解目标、做决定和整合结果；只有在任务足够独立、确实有收益或用户明确要求时，才创建子代理。

它适合需求讨论、PRD、任务拆分、技术设计、实现、测试、审查、发布和上线观察。它不会自动部署、绕过授权，也不会强制 Codex 执行每条规则。

## 安装

在本仓库根目录执行：

```sh
codex plugin marketplace add "$(pwd)"
codex plugin add spotter-orchestrator@personal
codex plugin list
```

如果 Codex 显示 Hook 信任提示，先检查以下文件，再决定是否信任：

```sh
sed -n '1,200p' plugins/spotter-orchestrator/hooks/hooks.json
sed -n '1,200p' plugins/spotter-orchestrator/hooks/inject.js
sed -n '1,260p' plugins/spotter-orchestrator/skills/orchestrate/SKILL.md
```

安装后新建 Codex 会话。已有会话不会自动获得新插件内容。

## 启动时发生什么

`SessionStart` Hook 在 `startup`、`resume`、`clear` 和 `compact` 时注入一段简短规则，要求 Codex：

- 小型、局部任务直接处理。
- 需要委派时才加载 `$orchestrate` 和当前角色。
- 每张实现票使用一个全新的执行代理，不继承主会话或上一票聊天历史。
- 同时活动的子代理最多三个，包含实现、测试和审查；不限制插件层面的累计创建数。
- 同票未验收前可补修，验收后结束代理；下一票创建另一个代理。
- 代理终态且没有遗留进程时记为已结束；宿主支持时调用关闭/释放，实际容量拒绝后才停止继续派发。
- 代理消息目标不超过 500 个 Unicode 字符，超过 800 个字符应先压缩。

八份角色文件不会在启动时全部注入。编排者只读取当前任务需要的角色文件。

## 配置模型

在使用 Orchestrator 的目标项目根目录创建：

```text
.codex/orchestrator.json
```

完整示例：

```json
{
  "models": {
    "main": "gpt-6-astra",
    "subagent": "gpt-5.6-sol"
  },
  "roles": {
    "product": {
      "model": "gpt-6-astra"
    },
    "design": {
      "model": "gpt-5.6-luna"
    },
    "code": {
      "model": "gpt-5.6-sol"
    },
    "test": {
      "model": "gpt-5.6-sol",
      "tasks": {
        "write": {
          "model": "gpt-6-astra"
        },
        "run": {
          "model": "gpt-5.6-sol"
        }
      }
    },
    "review": {
      "model": "gpt-6-astra"
    }
  }
}
```

只需要写希望覆盖的部分。没有配置文件时，使用角色文件里的内置默认值。

### 只配置主模型和子模型

```json
{
  "models": {
    "main": "gpt-6-astra",
    "subagent": "gpt-5.6-sol"
  }
}
```

这会覆盖所有未单独配置的主代理任务和子代理任务。

### 覆盖一个角色

```json
{
  "roles": {
    "observe": {
      "model": "gpt-5.6-luna"
    }
  }
}
```

### 覆盖一个具体任务

```json
{
  "roles": {
    "test": {
      "tasks": {
        "write": { "model": "gpt-6-astra" },
        "run": { "model": "gpt-5.6-sol" }
      }
    }
  }
}
```

### 模型选择优先级

从高到低：

1. 用户在当前请求中明确指定的模型。
2. `roles.<role>.tasks.<task>.model`。
3. `roles.<role>.model`。
4. 根据执行者选择 `models.main` 或 `models.subagent`。
5. 角色文件中的内置模型。

配置只改变模型，不改变执行者、权限、代理数量限制或角色规则。

解析结果的 `modelPolicy` 明确区分两种情况：

- `required`：用户在当前请求中明确指定的模型，以及所有子代理任务。模型不匹配或不可用时阻塞该任务，不静默替换。
- `preferred`：所有主代理任务，包括项目配置的主模型。宿主无法切换或确认模型时，继续使用当前主会话，但不声称已经切换。

插件不能自行切换或验证宿主模型。子代理模型会在创建时实际传入。

配置文件修改后，下一次任务派发会重新读取，无需重新构建或安装插件。

## 角色和任务

| 角色 | 任务 | 内置执行者与模型 |
| --- | --- | --- |
| `product` | `discuss` | 主代理，Astra |
| `product` | `research` | 子代理，Luna |
| `product` | `write_prd` | 子代理，Sol |
| `planning` | `split`、`sequence` | 主代理，Astra |
| `design` | `investigate` | 子代理，Luna |
| `design` | `technical` | 主代理，Astra |
| `design` | `interface`、`ui` | 子代理，Sol |
| `code` | `workspace` | 主代理，Astra |
| `code` | `read` | 子代理，Luna |
| `code` | `implement`、`fix`、`refactor` | 子代理，Sol |
| `test` | `write`、`analyze` | 子代理，Astra |
| `test` | `run` | 子代理，Sol |
| `review` | `code`、`requirements`、`regression` | 子代理，Sol |
| `release` | `prepare`、`deploy`、`rollback` | 子代理，Sol |
| `observe` | `health`、`logs`、`diagnose` | 子代理，Luna |

这些只是内置默认值，项目配置和当前用户指令可以覆盖模型。

## 基本使用

安装并新建会话后，正常描述任务即可。无需每次手动调用 Skill。

### 小型任务

```text
修正 README 中的一处错误，不要创建子代理。
```

局部任务由主代理直接完成。

### 委派实现

```text
实现 ticket 02。使用现有 feature worktree，只处理 ticket 范围，完成定向测试后返回结果。
```

编排者选择 `code.implement`，解析配置并优先使用一个执行者完成代码、普通回归测试和定向验证。

### 明确指定模型

```text
使用 gpt-5.6-luna 子代理调查支付流程，只读，不修改文件。
```

本次明确指定会覆盖项目配置和内置默认值。

### 分开编写和执行测试

```text
回归测试必须由 Astra 子代理编写，再由 Sol 子代理执行；使用同一个 feature worktree。
```

编排者依次选择 `test.write` 和 `test.run`。普通实现任务没有这个明确要求时，不会为了测试机械地再创建两个代理。

### 需求讨论和 PRD

```text
先讨论订阅功能的产品需求，不要写代码。
```

主代理负责讨论和确认决定。确有必要时，才使用 `product.research` 调查现状。讨论授权不会扩展为 PRD、实现或发布授权。

### 拆分 tickets

```text
把当前确认的 PRD 拆成可独立验收的 tickets，先给我确认，不要开始实现。
```

编排者使用 `planning.split`，遵循项目的 issue tracker 和已有 `to-tickets` 流程。

## Feature worktree

同一 feature 的所有 tickets 默认共享一个分支和 worktree：

```text
feature
└── one branch + one worktree
    ├── ticket 01
    ├── ticket 02
    ├── ticket 03
    └── ticket 04
```

规则如下：

- 创建前检查仓库自身的 worktree 约定、Git 状态和现有 worktree。
- 记录基点分支、基点提交、feature 分支、worktree 路径和整合目标。
- 同一个 worktree 同时只有一个写入者。
- 更换角色、模型或 ticket 不创建新的 worktree。
- 有依赖的 ticket 按顺序执行；实现返回不等于 ticket 已完成。
- 验收条件、必要证据和审查通过，相关执行结束并记录检查点后，才解除后续 ticket 的依赖。
- 未提交的前置改动不会自动进入新 worktree；不能擅自复制、stash、reset 或提交无关改动。

工作区选择依次遵循：用户当前选择、已有确认的 feature 工作区、仓库默认规则、插件默认规则。用户偏好独立 worktree 时，应在可行范围内落实；仓库默认“有未提交改动就留在原目录”不能覆盖该选择。相关未提交改动应作为前置内容按范围保留。若确实无法在现有授权内隔离且不影响其他改动，应说明具体障碍并解决缺失决定，不能直接改在 main 上执行。

派发前记录实际绝对路径、分支、基点、相关前置 checkpoint 和整合目标。交付时区分实现完成、已提交、本地已合并和已推送；main 上存在未提交修改不等于完成了合并。

## 子代理数量

每票一个执行代理，同时最多三个活动子代理，不计主协调者。实现、独立测试和审查代理共享这三个名额；运行中、仍有未结束进程或等待验收的代理都占活动名额。插件不再设置累计创建上限，但宿主自身的并发和累计容量限制仍有效。

不同票必须创建不同代理，使用 `fork_turns: "none"`。新代理读取当前票、前置 checkpoint 和相关证据，不携带上一票聊天历史。同一张尚未验收的票可通过 `followup_task` 修复缺项；独立审查也只能在同一个限定审查任务内复审，不能跨任务长期复用。

三个名额是上限，不要求填满。共享一个 worktree 的写入仍串行，有依赖的票仍等待前置验收。

## 完成与释放

执行者返回后先验收。同票补修完成、必要审查通过、相关进程结束并记录 checkpoint 后，才结束该代理。

验收反馈在发送给原代理前必须与票据的目标、非目标和验收条件比较：违反原验收条件的缺陷留在当前票；新增页面、流程、数据源、共享组件迁移、刷新策略、平台行为或其他实质能力必须创建新票并使用新代理。仅为满足原验收所必需的小型实现调整仍留在当前票。必须记录这次分类，不能因为原代理上下文方便而扩大票据。

- 代理返回终态且没有遗留进程时，记录为 `ended`。
- 宿主提供原生关闭/释放工具时，调用并检查结果后记录 `released`。
- 宿主没有该工具时，明确记录无法主动释放，但不因此阻止下一票派发，也不向已完成代理发送告别或中断来模拟释放。
- 完成或空闲不能单独证明遗留进程已经结束；未结束的进程需要通过原工具句柄停止并确认。
- 不删除 session 文件、不终止共享宿主进程，也不因结束代理删除 worktree 或证据。
- 后续票使用新代理；已验收票后来发现的问题作为新的限定修复任务，从 checkpoint 开始。

实际的容量拒绝是没有可用名额的权威证据。拒绝后应等待真实生命周期变化或执行宿主支持的释放，不因时间经过而反复创建。若仍无法容纳下一票的新代理，保留工作区和待执行票，交接到新主会话；不能改成跨票复用或主代理接管。

## 等待结果

优先接收宿主的完成通知。必须调用等待工具时，使用宿主和上级指令允许的最长可中断等待，不为了定时播报进度而缩短等待。

超时且没有新事件不代表状态变化，应继续等待原代理或进程句柄，不附带查询代理列表、催进度、重新派发或重复验证。只有状态缺失、已知过期或需要做派发决定时才刷新代理列表。必要的进度说明使用已知状态，不为生成说明额外运行工具。

等待必须允许用户输入和执行结果打断，并遵守更严格的等待上限及沟通要求。插件只能提供这些指令，无法阻止宿主在超时后再次调用模型，也不保证 token 节省。

## 代理通信

完整的 `spawn_agent`、`followup_task` 或 `send_message` 消息：

- 目标不超过 500 个 Unicode 字符。
- 超过 800 个字符时，发送前重新压缩。
- 只保留目标、路径、非目标、必要约束、验收条件和资料引用。
- 不复制完整文件、日志、历史对话或未变化的规则。
- 不能把一条长消息拆成多条来绕过限制。
- 必要信息确实无法压缩时可以超过 800，但要说明具体原因。

执行者应完成完整的约定单元。只有用户改变要求、真实阻塞、范围变化或必须切换模型时，才需要中途沟通。不要频繁催进度。

## 验收和会话寿命

主代理检查子代理的精简结果、相关 diff 和原始证据引用。只有发现具体缺口或矛盾时，才继续读取完整文件或日志。

代码和环境没有相关变化时，复用已有有效证据，不为确认子代理的一句报告而重复运行测试。

达到约定验收条件和仓库必需门禁后结束任务。额外改进单独记录，不在收尾阶段不断增加“最后一个优化”。

Feature 或阶段结束时，使用项目已有记录保存精简检查点：

- 已确认决定、范围和非目标。
- 分支、基点、整合目标和 worktree。
- 已验收 tickets 和证据引用。
- 阻塞项、代理所属票、验收及释放状态、仍在运行的工具句柄。

每票验收后也记录这些 checkpoint。worktree 可以继续保留，下一票代理从文件和检查点恢复，不从上一票对话恢复。

## 模型解析诊断

通常由编排者自动执行。开发或排查配置时，可以在本仓库运行：

```sh
node plugins/spotter-orchestrator/scripts/resolve-model.js \
  test write /absolute/path/to/target-project
```

示例输出：

```json
{
  "role": "test",
  "task": "write",
  "executor": "subagent",
  "model": "gpt-6-astra",
  "source": "roles.test.tasks.write.model",
  "modelPolicy": "required",
  "pluginRoot": "/installed/orchestrator",
  "roleFile": "/installed/orchestrator/skills/orchestrate/roles/test.agent.md"
}
```

Hook 的 `ORCHESTRATOR_PATHS` JSON 提供绝对 `pluginRoot`、`resolver` 和 `skillFile`。示例中的安装路径仅为占位；实际值从当前插件位置生成。派发时传递解析出的 `pluginRoot`、`roleFile` 和实际 worktree 绝对路径，子代理直接读取，不到业务仓库中寻找插件角色或重新拼接脚本路径。Shell 调用应给路径加引号。

配置中的未知字段、角色、任务，或空模型名称会返回退出码 `2`，并阻止此次派发。

## 常见问题

### 修改配置后没有生效

确认配置位于目标项目根目录的 `.codex/orchestrator.json`，并检查 JSON 是否有效。配置影响下一次派发，不会改变已经运行的代理。

### 主模型配置没有切换当前会话

这是预期行为。Orchestrator 不能切换已经启动的主会话。项目配置的主模型是 `preferred`，宿主无法切换或确认时继续使用当前会话。只有用户在当前请求中明确指定模型时才是 `required`。

### 配置的模型不可用

子代理模型不可用时，Orchestrator 不会静默替换；应修改配置、在当前请求中明确选择可用模型，或保留任务为阻塞状态。主代理配置只是偏好，当前会话可以继续。

### 子代理数量达到上限

以实际的容量拒绝为准。拒绝后等待现有任务结束或使用宿主支持的关闭/释放，并确认生命周期变化。没有释放工具时明确记录限制，不能把 `interrupt_agent` 当成释放。不要持续重试创建，不要为新票复用旧代理，也不要让主代理因容量不足接管。必要时从 checkpoint 在新主会话继续。

### Token 使用量仍然很高

检查是否存在以下情况：

- 小任务也启动了子代理。
- 主代理委派后仍重复调查和实现。
- 大量 `send_message`、`followup_task` 或状态轮询。
- 子代理返回完整代码和日志，而不是摘要及引用。
- 一个代理跨越多张票持续工作。

同票内减少无效往返，完成后结束代理；不同票使用全新上下文和精简 checkpoint。累计 input 大不等于计费或浪费，仍需区分缓存、非缓存和重复读取。

## 更新插件

修改 Orchestrator 源码后，从本仓库根目录执行：

```sh
python3 ~/.codex/skills/.system/plugin-creator/scripts/update_plugin_cachebuster.py \
  plugins/spotter-orchestrator
codex plugin add spotter-orchestrator@personal
```

然后新建会话。只修改目标项目的 `.codex/orchestrator.json` 不需要更新或重新安装插件。

## 卸载

```sh
codex plugin remove spotter-orchestrator@personal
```

卸载不会删除目标项目中的 `.codex/orchestrator.json`。只有确认没有其他插件使用 `personal` marketplace 时，才移除 marketplace：

```sh
codex plugin marketplace remove personal
```

## 能力边界

- 它是基于指令的编排插件，不是持久化工作流引擎。
- 模型配置由解析器校验，但是否遵守委派规则仍取决于宿主和模型。
- 它不会提高 Codex 原生代理数量限制。
- 它不会因为流程进入发布阶段而获得部署授权。
- 静态测试可以验证 Hook、角色定义和配置解析，不能证明真实模型调度、并发控制或 token 节省。
