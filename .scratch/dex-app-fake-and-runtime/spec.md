# DEX App Fake 与运行时约束

**Status:** recorded for discussion
**Recorded:** 2026-09-04

## Fake 要求

- Fake 只替换窄端口或能力，不替换整个 App 配置或整个 App 生命周期。
- Fake 必须 deterministic，并能显式控制成功、失败、延迟和状态变化。
- Fake 必须执行关键边界校验；不能无条件返回 canned success。
- Fake 可以记录请求，但记录应为不可变快照，只用于契约验证。
- 失败使用生产代码已有的错误类型和错误原因。
- 关闭后的 Fake 不可继续使用；`close()` 应保持幂等。
- Fake 放在独立的 testing API 中，生产 API 不暴露 Fake。
- 每个公共 Fake 至少有一份 contract/conformance 证据，且不访问网络、秘密或真实链写入。
- App 层测试只 Fake `CoreConsumerFactory` 或 `CoreConsumerComposition` 来验证启动、重试和关闭；配置加载单独验证。

## 配置入口

App 先由 `ConfigurationLoader` 读取并校验 manifest、版本、hash 和 environment，再由
`CoreConsumerRuntime` 组装一次性的 `CoreConsumerFactoryInput`。environment 是本次
Core composition 生命周期固定的配置，不应在各个 feature 或每次业务调用中重复传入。

## 运行时诊断约束

- Homebrew SQLite 在 `dlopen` 阶段挂起并导致唯一诊断进程被终止时，应把它记录为本机动态加载环境异常；不能据此归因到某一份 SQLite 库文件。
- `tensormatch_app` 是 Dart/Flutter App。Docker 不是默认的运行时或诊断替代品；只有明确需要隔离基础设施服务时才启动 Docker。
- 纯 Dart/Core 诊断应优先使用与 App 相同的 Dart/Flutter 依赖和进程边界，避免把容器环境结果误当成本机 App 结果。

## Test 问题记录

这次 SQLite 在 `dlopen` 阶段挂起，导致唯一诊断进程被终止，属于测试基础设施/本机运行时异常，不能判定为产品测试失败或某一份库文件损坏。

后续测试记录必须遵守：

- 保留原始运行环境和终止状态，不能把未完成的进程当作失败或通过。
- Docker 运行只能作为独立环境的诊断结果，不能覆盖或替代 Dart/Flutter App 的本机测试证据。
- 如果本机 native loading 仍不可用，优先切到不加载该 native 依赖的纯 Dart/Core 边界；否则明确记录为 blocked，而不是用 Docker 制造一个“通过”。

## 依据

- `tensormatch_app/lib/core/dex/core_consumer_configuration.dart`
- `tensormatch_app/lib/core/dex/core_consumer_runtime.dart`
- `dex-app-core/lib/src/api/consumer_factory_v1.dart`
- `dex-app-core/lib/src/testing/fake_wallet_send_transaction_capability.dart`
- `dex-app-core/test/conformance/wallet_send_transaction_conformance_v1_test.dart`
