# RabbitMQ 与业务消息说明

本文档说明当前第三行项目中哪些消息经过 RabbitMQ、RabbitMQ 管理页面中 exchange / queue 的含义，以及截图时应如何查看。

## 1. 当前 RabbitMQ 拓扑

当前代码只创建并使用 1 个业务 topic exchange：

- `logistics.events`

默认连接配置：

- RabbitMQ 地址：`amqp://localhost:5672`
- RabbitMQ 管理页面：`http://localhost:15672`
- 默认账号密码：`guest / guest`
- 业务 exchange：`logistics.events`
- Camunda 桥接队列：`camunda.message.bridge`

RabbitMQ 管理页面里看到 8 个 exchanges 是正常的。除 `logistics.events` 外，其余通常是 RabbitMQ 自带的默认 exchange，例如：

- `amq.direct`
- `amq.fanout`
- `amq.headers`
- `amq.match`
- `amq.rabbitmq.trace`
- `amq.topic`
- 空名称默认 exchange

因此，8 个 exchanges 不代表本项目创建了 8 个业务 exchange。本项目真正用于业务消息路由的 exchange 只有 `logistics.events`。

## 2. 7 个 Queue 分别代表什么

当前项目声明 7 个 queue：

| Queue | 作用 | 是否由当前项目消费 |
| --- | --- | --- |
| `camunda.message.bridge` | RabbitMQ -> Camunda 桥接队列 | 是 |
| `freight-forwarder.inbox` | 发给 Freight Forwarder 的业务消息收件箱 | 否 |
| `container-terminal.inbox` | 发给 Container Terminal 的业务消息收件箱 | 否 |
| `customs-broker.inbox` | 发给 Customs Broker 的业务消息收件箱 | 否 |
| `depot.inbox` | 发给 Depot 的业务消息收件箱 | 否 |
| `owner.inbox` | 发给 Owner 的业务消息收件箱 | 否 |
| `sbgs.inbox` | 发给 SBGS 的业务消息收件箱 | 否 |

其中只有 `camunda.message.bridge` 有 consumer。原因是当前项目只需要消费“用于推进 Camunda 流程”的消息；其他 inbox queue 表示船代向外部参与方发出的消息，真实系统中应由对应参与方服务消费。

## 3. 会转发到 Camunda 的消息

下面 4 类消息会进入 `camunda.message.bridge`，再由 bridge consumer 调用 Camunda message publication API。

| Routing key / 消息名 | Camunda 中的作用 | 来源 |
| --- | --- | --- |
| `so-received` | 启动 `Shipping Agency` 流程 | demo 模拟 Freight Forwarder 发送 |
| `ctn-arrival-info` | 推进 `CTN arrival info received` 等待事件 | demo 中由 `ask-for-ctn` worker 模拟 Depot 回复 |
| `ship-departure-notification` | 推进 `Ship departure` 等待事件 | demo 中由 `crewlist-received` worker 模拟 Container Terminal 回复 |
| `crewlist-received` | 启动 `SBGS` 流程 | `crewlist-received` worker 发送 |

这些消息的共同点：

- 都先发布到 `logistics.events`
- routing key 等于消息名
- 被绑定到 `camunda.message.bridge`
- bridge consumer 转发到 Camunda
- 使用 `orderId` 作为 correlation key
- 带 `timeToLive` 时，即使消息比流程等待点先到，也可以由 Camunda 在有效期内完成关联

## 4. 发给外部参与方的业务消息

下面这些消息也会发布到 RabbitMQ，但当前项目不会消费它们。

| 消息名 / routing key | 发送时机 | 目标 queue | 业务含义 |
| --- | --- | --- | --- |
| `ff-manifest-received` | `handle-manifest` 完成后 | `freight-forwarder.inbox` | 船代向货代发送舱单信息 |
| `ct-manifest-received` | `handle-manifest` 完成后 | `container-terminal.inbox` | 船代向码头发送舱单信息 |
| `cb-manifest-received` | `handle-manifest` 完成后 | `customs-broker.inbox` | 船代向报关/海关代理发送舱单信息 |
| `make-equipment-receipt` | `make-equipment-receipt` 执行时 | `freight-forwarder.inbox` | 船代生成并发送设备交接单 |
| `ask-for-ctn` | `ask-for-ctn` 执行时 | `depot.inbox` | 船代向货场请求集装箱 |
| `ship-arrive-at-ct` | `ship-arrive-at-ct` 执行时 | `container-terminal.inbox` | 船代通知码头船到港 |
| `crewlist-received` | `crewlist-received` 执行时 | `sbgs.inbox` | 船代向边防发送船员名单 |
| `expense-note-received` | `expense-note-received` 执行时 | `owner.inbox` | 船代向货主发送费用单 |

注意：`crewlist-received` 同时绑定到 `sbgs.inbox` 和 `camunda.message.bridge`。这表示它既是发给 SBGS 的业务消息，又会触发本项目中的 SBGS BPMN 流程。

## 5. 当前消息流转路径

完整演示时的关键路径如下：

```text
demo
  -> RabbitMQ logistics.events / so-received
  -> camunda.message.bridge
  -> Camunda 启动 Shipping Agency

Shipping Agency: handle Manifest
  -> RabbitMQ logistics.events / ff-manifest-received
  -> freight-forwarder.inbox

Shipping Agency: handle Manifest
  -> RabbitMQ logistics.events / ct-manifest-received
  -> container-terminal.inbox

Shipping Agency: handle Manifest
  -> RabbitMQ logistics.events / cb-manifest-received
  -> customs-broker.inbox

Shipping Agency: Make Equipment Receipt
  -> RabbitMQ logistics.events / make-equipment-receipt
  -> freight-forwarder.inbox

Shipping Agency: ask Depot for CTN
  -> RabbitMQ logistics.events / ask-for-ctn
  -> depot.inbox

demo 模拟 Depot 回复
  -> RabbitMQ logistics.events / ctn-arrival-info
  -> camunda.message.bridge
  -> Camunda 推进 CTN arrival info received

Shipping Agency: ship arrive at CT
  -> RabbitMQ logistics.events / ship-arrive-at-ct
  -> container-terminal.inbox

Shipping Agency: make Crew List to SBGS
  -> RabbitMQ logistics.events / crewlist-received
  -> sbgs.inbox
  -> camunda.message.bridge
  -> Camunda 启动 SBGS

demo 模拟 Container Terminal 离港通知
  -> RabbitMQ logistics.events / ship-departure-notification
  -> camunda.message.bridge
  -> Camunda 推进 Ship departure

Shipping Agency: Issue expense note
  -> RabbitMQ logistics.events / expense-note-received
  -> owner.inbox
```

## 6. 如何在 RabbitMQ 页面查看

打开 RabbitMQ 管理页面：

```text
http://localhost:15672
```

登录：

```text
guest / guest
```

### 6.1 查看 Exchange

进入 `Exchanges` 页面，找到：

- `logistics.events`

说明：

- 这是当前项目真正使用的业务 exchange。
- 其他 `amq.*` exchange 是 RabbitMQ 默认内置对象。

建议截图：

- 截 `Exchanges` 列表，框出 `logistics.events`。

### 6.2 查看 Queue

进入 `Queues and Streams` 页面，应能看到：

- `camunda.message.bridge`
- `freight-forwarder.inbox`
- `container-terminal.inbox`
- `customs-broker.inbox`
- `depot.inbox`
- `owner.inbox`
- `sbgs.inbox`

建议截图：

- 截 `Queues and Streams` 列表。
- 重点框出 `camunda.message.bridge`，它应显示 `Consumers = 1`。
- 外部 inbox queue 通常显示 `Consumers = 0`，这是合理的，因为当前项目没有实现其他参与方消费者。

### 6.3 查看 Binding

点进 `camunda.message.bridge`，查看 `Bindings`，应看到：

- `so-received`
- `ctn-arrival-info`
- `ship-departure-notification`
- `crewlist-received`

点进外部 queue，可以看到它们绑定的 routing key，例如：

- `freight-forwarder.inbox`：`ff-manifest-received`、`make-equipment-receipt`
- `container-terminal.inbox`：`ct-manifest-received`、`ship-arrive-at-ct`
- `customs-broker.inbox`：`cb-manifest-received`
- `depot.inbox`：`ask-for-ctn`
- `owner.inbox`：`expense-note-received`
- `sbgs.inbox`：`crewlist-received`

## 7. 答辩说明建议

可以这样解释：

当前项目没有让 Worker 直接调用 Camunda 发送业务消息，而是统一先发布到 RabbitMQ 的 `logistics.events`。需要推进 Camunda 流程的消息进入 `camunda.message.bridge`，由桥接消费者转发给 Camunda；发给外部参与方的业务消息进入各自的 inbox queue，表示跨组织异步通信边界。这样既保留了 Camunda 的流程编排能力，也体现了 RabbitMQ 作为消息中间件解耦外部参与方的作用。
