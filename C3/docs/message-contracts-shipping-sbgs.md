# 第三行项目实际消息格式说明

本文档描述的是当前项目代码中的实际消息名、主要字段和 RabbitMQ 转发关系，不再使用早期建议稿命名。

## 1. 统一约定

- 消息名使用 `全小写 + 中划线`
- 关联键统一使用 `orderId`
- 公共字段通常包含：
  - `orderId`
  - `timestamp`
  - `senderId`

## 2. RabbitMQ 配置

当前项目默认使用以下 RabbitMQ 配置：

- `RABBITMQ_URL`: `amqp://localhost:5672`
- `RABBITMQ_EXCHANGE`: `logistics.events`
- `RABBITMQ_CAMUNDA_QUEUE`: `camunda.message.bridge`

其中：

- 所有业务消息先发布到 `logistics.events`
- 以下 4 类消息会被桥接消费者转发到 Camunda：
  - `so-received`
  - `ctn-arrival-info`
  - `ship-departure-notification`
  - `crewlist-received`
- 外部参与方的业务消息通过独立 inbox queue 表达接收边界：
  - `freight-forwarder.inbox`
  - `container-terminal.inbox`
  - `customs-broker.inbox`
  - `depot.inbox`
  - `owner.inbox`
  - `sbgs.inbox`

说明：

- RabbitMQ 中看到 8 个 exchange 是正常现象，除 `logistics.events` 外，其余通常是 RabbitMQ 自带的 `amq.*` 默认 exchange。
- 当前项目使用 1 个业务 topic exchange，通过 routing key 区分 8 个对外输出消息。
- Producer 不是 RabbitMQ 管理页中的常驻对象；代码中每次 `publishBusinessMessage` 调用就是一次发送行为。
- Consumer 只有 1 个是合理的，因为当前只有 `camunda.message.bridge` 需要被本项目消费并转发到 Camunda；其他外部参与方 inbox queue 用于表达对外发送边界。

## 3. Camunda 监听消息

### 3.1 `so-received`

- 作用：启动 `Shipping Agency` 流程
- 转发路径：RabbitMQ -> `camunda.message.bridge` -> Camunda message publication

实际字段示例：

```json
{
  "orderId": "ORDER-20260520-001",
  "timestamp": "2026-05-20T06:00:00.000Z",
  "senderId": "FFW",
  "vesselId": "VESSEL-042",
  "voyageNo": "VOY-2026-118",
  "voyageNumber": "VOY-2026-118",
  "containerId": "MSKU1234567",
  "ownerId": "OWN-001",
  "manifestNo": "MAN-20260416-001",
  "soNo": "SO-20260416-001",
  "loadingPortCode": "CNSHA",
  "dischargePortCode": "JPTYO",
  "eta": "2026-04-18T08:00:00Z",
  "containerCount": 2,
  "depotId": "DPT-SHA-01",
  "requestedContainerType": "40HQ",
  "requestedContainerCount": 2,
  "terminalId": "CTE-TYO-01",
  "manifestRequestId": "MANIFEST-REQ-ORDER-20260520-001",
  "eirRequestId": "ER-ORDER-20260520-001",
  "timeToLive": 300000
}
```

### 3.2 `ctn-arrival-info`

- 作用：推进 `Shipping Agency` 流程中 `CTN arrival info received` 等待点
- 发送方：demo 中由 `ask-for-ctn` worker 模拟货场回复

实际字段示例：

```json
{
  "orderId": "ORDER-20260520-001",
  "timestamp": "2026-05-20T06:00:10.000Z",
  "senderId": "DEPOT-01",
  "containerId": "MSKU1234567",
  "ctnArrivalConfirmed": true,
  "timeToLive": 300000
}
```

### 3.3 `ship-departure-notification`

- 作用：推进 `Shipping Agency` 流程中 `Ship departure` 等待点
- 发送方：demo 中由 `crewlist-received` worker 模拟码头回复

实际字段示例：

```json
{
  "orderId": "ORDER-20260520-001",
  "timestamp": "2026-05-20T06:00:20.000Z",
  "senderId": "CONTAINER-TERMINAL-01",
  "vesselId": "VESSEL-042",
  "departureTime": "2026-05-20T06:00:20.000Z",
  "voyageNo": "VOY-2026-118",
  "timeToLive": 300000
}
```

### 3.4 `crewlist-received`

- 作用：启动 `SBGS` 流程
- 发送方：`Shipping Agency` 流程中的 `crewlist-received` worker

实际字段示例：

```json
{
  "orderId": "ORDER-20260520-001",
  "timestamp": "2026-05-20T06:00:15.000Z",
  "senderId": "SAG",
  "crewListNo": "CRL-ORDER-20260520-001",
  "vesselId": "VESSEL-042",
  "voyageNo": "VOY-2026-118",
  "departurePortCode": "JPTYO",
  "estimatedDepartureTime": "2026-04-19T18:00:00Z",
  "captainName": "LEE MINHO",
  "crewCount": 2,
  "crewMembers": [
    {
      "fullName": "LEE MINHO",
      "nationalityCode": "KR",
      "passportNo": "M12345678",
      "rank": "Captain"
    }
  ]
}
```

## 4. Shipping Agency 对外业务消息

下面这些消息不会被 Camunda 直接消费，但会真实发布到 RabbitMQ `logistics.events`。

当前第三行对外输出共 8 类消息：

- `ff-manifest-received`
- `ct-manifest-received`
- `cb-manifest-received`
- `make-equipment-receipt`
- `ask-for-ctn`
- `ship-arrive-at-ct`
- `crewlist-received`
- `expense-note-received`

与参考图的对应说明：

- 业务流程图中的 `CTN Arrival Terminal` 在当前 BPMN / 代码中对应 `ship-arrive-at-ct`，由 Shipping Agency 发给 Container Terminal。
- 业务流程图中的 `CTN Loaded` 没有在完整 BPMN 协作图中表现为 Shipping Agency 的单独接收事件。当前实现按完整 BPMN 协作图处理：Shipping Agency 后续等待的是 `Ship departure`，即代码中的 `ship-departure-notification`。
- 因此本项目不额外增加 `ctn-loaded` 消息捕获事件，避免和完整 BPMN 协作图不一致。
- `handle Manifest` 和 `Make Equipment Receipt` 都由 `S/O received` 提供必要输入，二者之间没有严格数据依赖，因此当前 BPMN 使用并行网关让两者并发执行，并在进入 `ask Depot for CTN` 前汇聚。

### 4.1 `ff-manifest-received`

- 触发时机：`handle-manifest` 完成后
- 接收对象语义：Freight Forwarder

实际字段：

- `orderId`
- `timestamp`
- `senderId`
- `manifestNo`
- `soNo`
- `vesselId`
- `voyageNo`
- `loadingPortCode`
- `dischargePortCode`
- `eta`
- `containerCount`

### 4.2 `ct-manifest-received`

- 触发时机：`handle-manifest` 完成后
- 接收对象语义：Container Terminal
- 字段与 `ff-manifest-received` 相同

### 4.3 `cb-manifest-received`

- 触发时机：`handle-manifest` 完成后
- 接收对象语义：Customs / Customs Broker 语义占位
- 字段与 `ff-manifest-received` 相同

### 4.4 `make-equipment-receipt`

- 触发时机：`make-equipment-receipt` worker 执行时

实际字段示例：

```json
{
  "orderId": "ORDER-20260520-001",
  "timestamp": "2026-05-20T06:00:05.000Z",
  "senderId": "SAG",
  "equipmentReceiptNo": "ER-ORDER-20260520-001",
  "manifestNo": "MAN-20260416-001",
  "depotId": "DPT-SHA-01",
  "vesselId": "VESSEL-042",
  "voyageNo": "VOY-2026-118",
  "requestedContainerType": "40HQ",
  "requestedContainerCount": 2,
  "pickupValidUntil": "2026-04-17T23:59:59Z"
}
```

### 4.5 `ask-for-ctn`

- 触发时机：`ask-for-ctn` worker 执行时

实际字段示例：

```json
{
  "orderId": "ORDER-20260520-001",
  "timestamp": "2026-05-20T06:00:08.000Z",
  "senderId": "SAG",
  "requestNo": "REQ-ORDER-20260520-001",
  "equipmentReceiptNo": "ER-ORDER-20260520-001",
  "depotId": "DPT-SHA-01",
  "requestedContainerType": "40HQ",
  "requestedContainerCount": 2,
  "requiredBefore": "2026-04-17T12:00:00Z",
  "purpose": "Export loading",
  "remarks": "Please confirm availability"
}
```

### 4.6 `ship-arrive-at-ct`

- 触发时机：`ship-arrive-at-ct` worker 执行时

实际字段示例：

```json
{
  "orderId": "ORDER-20260520-001",
  "timestamp": "2026-05-20T06:00:12.000Z",
  "senderId": "SAG",
  "arrivalNoticeNo": "ARR-ORDER-20260520-001",
  "vesselId": "VESSEL-042",
  "voyageNo": "VOY-2026-118",
  "terminalId": "CTE-TYO-01",
  "actualArrivalTime": "2026-04-18T08:00:00Z",
  "berthNo": "B12",
  "manifestNo": "MAN-20260416-001",
  "arrivalStatus": "arrived"
}
```

### 4.7 `expense-note-received`

- 触发时机：`expense-note-received` worker 执行时

实际字段示例：

```json
{
  "orderId": "ORDER-20260520-001",
  "timestamp": "2026-05-20T06:00:25.000Z",
  "senderId": "SAG",
  "expenseNoteNo": "EXP-ORDER-20260520-001",
  "ownerId": "OWN-001",
  "vesselId": "VESSEL-042",
  "voyageNo": "VOY-2026-118",
  "issueDate": "2026-05-20T06:00:25.000Z",
  "currency": "USD",
  "totalAmount": 1250.5,
  "chargeItems": [
    {
      "itemName": "Terminal handling charge",
      "amount": 800,
      "currency": "USD"
    }
  ]
}
```

## 5. SBGS Worker 输出

当前 `personnel-information-registration` worker 只完成任务并写回流程变量，没有再向外发布 RabbitMQ 业务消息。

写回变量包括：

- `sbgsCheckCompleted`
- `sbgsCheckTimestamp`

## 6. 与 BPMN / Worker 的实际对应关系

当前代码中的服务任务类型为：

- `handle-manifest`
- `make-equipment-receipt`
- `ask-for-ctn`
- `ship-arrive-at-ct`
- `crewlist-received`
- `expense-note-received`
- `personnel-information-registration`

当前代码中的关键消息名为：

- `so-received`
- `ctn-arrival-info`
- `ship-departure-notification`
- `crewlist-received`
- `ff-manifest-received`
- `ct-manifest-received`
- `cb-manifest-received`
- `make-equipment-receipt`
- `ask-for-ctn`
- `ship-arrive-at-ct`
- `expense-note-received`
