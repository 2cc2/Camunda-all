# 船代与边防消息契约建议稿

以下内容按你们共享文档的命名约束整理：

- 消息名使用 `全小写 + 中划线`
- 关联键统一 `orderId`
- 公共字段统一包含：
  - `orderId`
  - `timestamp`
  - `senderId`

## Shipping Agency 对外消息

### 1. manifest-file-to-ff

- 发送方：`Shipping Agency`
- 接收方：`Freight Forwarder`
- 触发时机：`handle-manifest` 完成后
- 业务意义：向货代回传舱单文件，支持后续订舱、装箱和报关协作

建议字段：

- `orderId`: string
- `timestamp`: string
- `senderId`: string
- `manifestId`: string
- `vesselId`: string
- `voyageNumber`: string
- `containerId`: string
- `cargoDescription`: string

示例：

```json
{
  "orderId": "ORDER-20260421-001",
  "timestamp": "2026-04-21T09:30:00Z",
  "senderId": "SHIPPING-AGENCY-01",
  "manifestId": "MAN-ORDER-20260421-001",
  "vesselId": "VESSEL-042",
  "voyageNumber": "V2026-042E",
  "containerId": "MSKU1234567",
  "cargoDescription": "Plush Toys"
}
```

### 2. equipment-receipt-to-ff

- 发送方：`Shipping Agency`
- 接收方：`Freight Forwarder`
- 触发时机：`make-equipment-receipt` 完成后
- 业务意义：向货代回传设备交接单

建议字段：

- `orderId`: string
- `timestamp`: string
- `senderId`: string
- `equipmentReceiptId`: string
- `containerId`: string
- `pickupDepotId`: string
- `validUntil`: string

### 3. ship-arrival-message

- 发送方：`Shipping Agency`
- 接收方：`Container Terminal`
- 触发时机：`ship-arrive-at-ct` 执行时
- 业务意义：通知码头船舶到港准备装船

建议字段：

- `orderId`: string
- `timestamp`: string
- `senderId`: string
- `vesselId`: string
- `voyageNumber`: string
- `estimatedArrivalTime`: string
- `containerId`: string

### 4. manifest-received

- 发送方：`Shipping Agency`
- 接收方：`Container Terminal`
- 触发时机：`handle-manifest` 完成后
- 业务意义：向码头提供装船舱单

建议字段：

- `orderId`: string
- `timestamp`: string
- `senderId`: string
- `manifestId`: string
- `vesselId`: string
- `containerId`: string
- `cargoDescription`: string

### 5. crew-list-to-sbgs

- 发送方：`Shipping Agency`
- 接收方：`SBGS`
- 触发时机：`make-crew-list-to-sbgs` 执行时
- 业务意义：向边防提交船员名单，供边防完成人员登记

建议字段：

- `orderId`: string
- `timestamp`: string
- `senderId`: string
- `crewListId`: string
- `vesselId`: string
- `captainName`: string
- `crewCount`: number
- `nationality`: string

示例：

```json
{
  "orderId": "ORDER-20260421-001",
  "timestamp": "2026-04-21T12:00:00Z",
  "senderId": "SHIPPING-AGENCY-01",
  "crewListId": "CREW-ORDER-20260421-001",
  "vesselId": "VESSEL-042",
  "captainName": "Wang Wei",
  "crewCount": 21,
  "nationality": "CN"
}
```

## SBGS 对外消息

### 6. sbgs-clearance-to-sa

- 发送方：`SBGS`
- 接收方：`Shipping Agency`
- 触发时机：`personnel-information-registration` 完成后
- 业务意义：通知船代边防审核已完成

建议字段：

- `orderId`: string
- `timestamp`: string
- `senderId`: string
- `clearanceId`: string
- `vesselId`: string
- `result`: string
- `remarks`: string

示例：

```json
{
  "orderId": "ORDER-20260421-001",
  "timestamp": "2026-04-21T12:10:00Z",
  "senderId": "SBGS-01",
  "clearanceId": "SBGS-CLR-20260421-001",
  "vesselId": "VESSEL-042",
  "result": "approved",
  "remarks": "crew registration completed"
}
```

## 与现有 BPMN 的对应关系

- BPMN 已实际使用：
  - `so-received`
  - `ctn-arrival-info`
  - `ship-departure-notification`
  - `crew-list-to-sbgs`
- 其余消息主要用于你们的共享文档和课堂答辩说明。
