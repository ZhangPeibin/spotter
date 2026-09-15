# DEX App 开发 Rules

**Status:** draft
**Recorded:** 2026-09-04
**Scope:** Dart/Flutter App 与 `dex-app-core` 的测试替身、验证证据和运行时诊断

## Fake

1. **MUST** 先定义被验证的行为和 fault boundary，再决定是否需要 Fake。
2. **MUST** 优先使用真实的纯逻辑、本地内存实现、临时目录或临时数据库。
3. **MUST NOT** 为内部调用顺序、方法调用次数或实现细节创建 Fake。
4. **MUST** 只替换窄端口或能力；**MUST NOT** 替换整个 App、整个配置或整个 Core composition。
5. **MUST** 让 Fake deterministic，并通过显式输入控制成功、失败、延迟和状态变化；禁止隐藏全局环境。
6. **MUST** 保留真实边界的关键校验，校验失败时使用生产错误类型和错误原因，并 fail closed。
7. **MAY** 记录请求，但记录必须是不可变快照，只用于验证公开契约，不用于断言内部 choreography。
8. **MUST** 定义清楚 ownership 和生命周期；关闭后不可用，`close()` 应幂等。
9. **MUST** 将公共 Fake 放在独立 testing API 中，并为其提供 contract/conformance 证据。
10. **MUST NOT** 让 Fake 访问真实网络、秘密、生产数据或执行真实链写入。

## Evidence

11. **MUST** 一条行为声明只保留一个主要证据；普通改动默认不生成独立 evidence artifact。
12. **MAY** 在发布、兼容性、安全、审计或明确要求时生成 artifact；artifact 必须绑定命令、提交、配置、环境和终止状态。
13. **MUST** 区分 behavioral evidence、artifact integrity 和 external observation；它们不能互相替代。
14. **MUST NOT** 把测试名称、源码片段、预先写好的 `PASS` JSON 或未结束的进程当作行为证据。
15. **MUST** 保留 `blocked`、`unknown` 和 `not run`；不能为了得到绿色结果而扩大 Fake 或切换到不等价环境。
16. **MUST** 在跨仓库验证中记录实际使用的 Core revision；历史 evidence 只有在依赖、配置和环境绑定一致时才能复用。

## App 配置入口

17. **MUST** 在 composition root 加载并验证 manifest、版本、hash 和 environment。
18. **MUST** 将已验证的 environment 作为 composition 生命周期内的不可变输入传给 Factory 一次。
19. **MUST NOT** 在 feature、repository 或每次业务调用中重复传递 environment 配置。
20. App 层只为验证 Runtime 编排而替换 `CoreConsumerFactory` 或 `CoreConsumerComposition`；配置加载单独验证。

## Runtime 与 Docker

21. **MUST** 把 native `dlopen` 挂起、进程被终止等情况记录为测试基础设施/本机运行时异常，不能直接归因到某个库文件或产品逻辑。
22. **MUST** 保留原始进程的终止状态；超时、挂起和中止都不是通过，也不能自动改写成普通测试失败。
23. **MUST NOT** 默认启动 Docker 来替代 Dart/Flutter App 的本机测试。
24. Docker 结果只能作为独立环境观察；只有明确需要隔离基础设施服务时才使用，不能覆盖本机 App 证据。
25. native loading 不可用时，**SHOULD** 先选择不加载该 native 依赖的纯 Dart/Core 边界；否则标记 `blocked`。

## Context continuity

26. **MUST NOT** 把 `Conversation recap` 当作测试证据或新的需求来源。
27. 上下文压缩后，**MUST** 以本规则文件、任务记录和实际工作树为准，避免重复生成 Fake、报告或历史 evidence。
