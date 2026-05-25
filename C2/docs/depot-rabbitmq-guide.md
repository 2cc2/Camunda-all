# Depot RabbitMQ Integration Guide

## Purpose

This document is the UTF-8 companion guide for the current C2 Depot implementation.
It reflects the RabbitMQ-based integration that sits between upstream participants and Camunda.

## Current architecture

- Upstream inbound:
  - `ask-for-ctn`
  - `outbound-ctn-to-depot`
- Middleware:
  - RabbitMQ exchange: `camunda.events`
  - DLQ exchange: `dlx.camunda`
- Depot inbound queue:
  - `camunda.depot`
- Downstream queues:
  - `camunda.transport`
  - `camunda.shipping-agency`
  - `camunda.container-terminal`
- Audit queue:
  - `camunda.all`
- Dead-letter queue:
  - `dlq.camunda`

## Contract compatibility with C3

`outbound-ctn-to-depot` is compatible with both:

- `handOverTime`
- `handoverTime`

Depot normalizes the payload internally and continues processing with `handOverTime`.

## Scripts

- `npm run start`
  - Starts Depot workers and the RabbitMQ bridge.
- `npm run demo -- --orderId=ORDER-YYYYMMDD-NNN --mockInbound=true`
  - Deploys BPMN, starts the bridge, and pushes mock inbound messages through RabbitMQ.
- `npm run demo:e2e -- --orderId=ORDER-YYYYMMDD-NNN --mockInbound=true`
  - Runs the Depot demo and observes the three outbound queues.
- `npm run mock:inbound -- --orderId=ORDER-YYYYMMDD-NNN`
  - Sends the two Depot inbound messages through RabbitMQ.
- `npm run mock:c3 -- --orderId=ORDER-YYYYMMDD-NNN`
  - Sends a C3-compatible `outbound-ctn-to-depot` payload using `handoverTime`.
- `npm run watch:outbound`
  - Listens through a temporary exclusive observer queue without consuming the real downstream queues.

## Reliability behavior

- Failed Camunda forward attempts are retried up to 3 times.
- After retries are exhausted, the message is moved to `dlq.camunda`.
- Failure logs include:
  - `orderId`
  - `camundaMessageName`
  - retry count

## Report Draft

### C2 Depot已完成修改内容

1. 完成了 `Depot` 独立 BPMN 与 Node.js Worker 的整理与接线，形成可独立运行的 Camunda 8 模块。
2. 将原先“Worker 直接调用 Camunda publishMessage”的实现改为“RabbitMQ 中间件转发”模式。
3. 新增 RabbitMQ 基础组件：
   - `publisher.ts`
   - `consumer.ts`
   - `bridge.ts`
   - `config.ts`
4. 为中间件补充了失败重试与死信队列机制：
   - 主交换机：`camunda.events`
   - 死信交换机：`dlx.camunda`
   - 死信队列：`dlq.camunda`
   - 最大重试次数：3 次
5. 统一了 `Depot` 的入站与出站消息队列命名：
   - `camunda.depot`
   - `camunda.transport`
   - `camunda.shipping-agency`
   - `camunda.container-terminal`
   - `camunda.all`
6. 统一并修正了 `outbound-ctn-to-depot` 的正式 JSON 契约，使其与 C3 侧 Transport 更容易联调。
7. 针对 C3 现有实现做了兼容处理：
   - 同时兼容 `handOverTime`
   - 同时兼容 `handoverTime`
8. 保留并强化了消息字段校验：
   - `orderId` 必须符合 `ORDER-YYYYMMDD-NNN`
   - 集装箱号必须符合 `4字母 + 7数字`
   - 船舶编号必须符合 `VESSEL-NNN`
9. 新增旁路观察器 `observer.ts` 与 `watch:outbound` 脚本，用于监听出站消息，同时避免抢占真实下游队列。
10. 新增 `demo:e2e` 脚本，用于执行“部署 BPMN + 启动 Bridge + 注入入站消息 + 观测三条出站消息”的闭环验证。
11. 新增 `mock:c3` 脚本，用于发送符合 C3 风格的 `outbound-ctn-to-depot` 测试消息。
12. 为主进程和监听脚本补充了优雅退出逻辑，保证 `Ctrl+C` 时正确关闭 Worker 和 RabbitMQ 连接。
13. 为 RabbitMQ 配置与契约兼容逻辑补充了单元测试。

### 当前启动方式

1. 进入目录：

```bash
cd C2\code-camunda8\depot\nodejs
```

2. 安装依赖：

```bash
npm install
```

3. 启动 RabbitMQ：

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

4. 启动本地 Camunda 8 Run，并确认以下地址可访问：

```text
REST:  http://localhost:8080
gRPC:  localhost:26500
```

5. 运行带观测的闭环 Demo：

```bash
npm run demo:e2e -- --orderId=ORDER-20260525-001 --mockInbound=true
```

6. 如果只想运行 Depot 服务：

```bash
npm run start
```

7. 如果只想发送 Depot mock 入站消息：

```bash
npm run mock:inbound -- --orderId=ORDER-20260525-001
```

8. 如果想模拟 C3 侧发送 `outbound-ctn-to-depot`：

```bash
npm run mock:c3 -- --orderId=ORDER-20260525-001
```

9. 如果想单独旁路观察三条出站消息：

```bash
npm run watch:outbound
```

### 当前验证结果

1. TypeScript 编译已通过。
2. Jest 测试已通过。
3. 当前单元测试共通过 32 项。
4. 代码侧已经具备：
   - 契约校验
   - RabbitMQ 中间件转发
   - 失败重试
   - 死信处理
   - C3 兼容入站消息
   - 出站消息旁路观察
5. 若要完成真实端到端联调，还需要本机实际启动 Camunda 与 RabbitMQ 服务。

### 可直接写入实验报告的总结

本阶段我们完成了 C2 组 `Depot` 模块从“Camunda 直接消息发布”到“基于 RabbitMQ 的消息中间件转发”的升级。系统结构调整为：上游参与方先将消息发送至 RabbitMQ，由 `Depot` 的 Consumer/Bridge 转发到 Camunda 流程引擎；流程执行过程中，`Depot` Worker 再将三条出站消息发布到各自下游队列，从而实现更符合跨组织协作场景的异步解耦架构。

在实现过程中，我们补全了 RabbitMQ Publisher、Consumer、Bridge、Observer 等组件，增加了重试和死信队列机制，并将 `outbound-ctn-to-depot` 的消息契约统一到正式 JSON 格式。同时，为兼容 C3 组当前的 Transport 代码，系统额外支持 `handoverTime` 与 `handOverTime` 两种字段写法。为保证联调安全性，我们还设计了临时独占观察队列，确保在监听出站消息时不会抢占真实下游消费者的正式队列。

经过本地构建与测试，当前 `Depot` 模块已完成编译通过，并通过全部单元测试，具备“可说明、可运行、可测试、可联调”的交付条件。后续工作重点将从代码实现转向真实环境联调、运行截图采集与实验材料整理。
