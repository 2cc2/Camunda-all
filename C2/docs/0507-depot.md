# Depot 契约文档正式版

## 1. 文档目的

本文档给出 `Depot` 模块在 Camunda 8 项目中的正式契约定义、流程边界、消息字段、Node.js 实现映射与本地测试方式，作为：

- `Depot` 独立实现说明
- 与 `Shipping Agency`、`Transport`、`Container Terminal` 联调时的消息契约依据
- 本地单元测试与 mock 测试的验收说明

对应代码与模型位置：

- BPMN: [depot.bpmn](/E:/1_course/Phd_Y1_S2/Concurrency_theory/Project20260331/Camunda/code-camunda8/depot/bpmn/depot.bpmn:1)
- Node.js: [code-camunda8/depot/nodejs](/E:/1_course/Phd_Y1_S2/Concurrency_theory/Project20260331/Camunda/code-camunda8/depot/nodejs)

## 2. 业务边界

`Depot` 在当前项目中的职责是处理出口协作链路中的货场环节。

当前确认的上游与下游关系如下：

- 上游第一条消息：`ask-for-ctn`
- 上游发送方向：`Shipping Agency -> Depot`
- 中途入站消息：`outbound-ctn-to-depot`
- 中途发送方向：`Transport -> Depot`
- 下游出站消息：
  - `empty-ctn-to-transport`
  - `ctn-arrival-info-to-sa`
  - `outbound-ctn-to-ct`

这和现有协作图保持一致：

- [Shipping-Agency.bpmn](/E:/1_course/Phd_Y1_S2/Concurrency_theory/Project20260331/Camunda/code-camunda8/message-demo/bpmn/Shipping-Agency.bpmn:12)
- [Depot.bpmn](/E:/1_course/Phd_Y1_S2/Concurrency_theory/Project20260331/Camunda/code-camunda8/message-demo/bpmn/Depot.bpmn:7)

## 3. 命名与公共约定

依据 `并发理论大作业命名规则.docx`，Depot 实现采用以下统一约定：

- 参与方缩写：
  - `Depot (DPT)`
  - `Shipping Agency (SAG)`
  - `Transport (TRP)`
  - `Container Terminal (CTE)`
- 消息名：全小写 + 中划线
- Task Type：全小写 + 中划线
- 关联键：统一为 `orderId`
- `orderId` 格式：`ORDER-YYYYMMDD-NNN`
- 公共字段：
  - `orderId: string`
  - `timestamp: string`
  - `senderId: string`
- 数据格式：
  - 集装箱号：`4字母 + 7数字`
  - 船舶编号：`VESSEL-NNN`

当前代码中的对应常量定义见：

- [config.ts](/E:/1_course/Phd_Y1_S2/Concurrency_theory/Project20260331/Camunda/code-camunda8/depot/nodejs/source/config.ts:1)

## 4. BPMN 流程定义

`Depot` 流程的 BPMN Process ID 为：

- `depot-export-contract`

流程主链路如下：

1. 启动流程
2. 等待消息 `ask-for-ctn`
3. 执行任务 `send-empty-ctn-to-transport`
4. 执行任务 `send-ctn-arrival-info-to-sa`
5. 等待消息 `outbound-ctn-to-depot`
6. 执行任务 `send-outbound-ctn-to-ct`
7. 结束流程

对应 BPMN 元素见：

- 消息 `ask-for-ctn`: [depot.bpmn](/E:/1_course/Phd_Y1_S2/Concurrency_theory/Project20260331/Camunda/code-camunda8/depot/bpmn/depot.bpmn:56)
- 消息 `outbound-ctn-to-depot`: [depot.bpmn](/E:/1_course/Phd_Y1_S2/Concurrency_theory/Project20260331/Camunda/code-camunda8/depot/bpmn/depot.bpmn:62)
- 任务 `send-empty-ctn-to-transport`: [depot.bpmn](/E:/1_course/Phd_Y1_S2/Concurrency_theory/Project20260331/Camunda/code-camunda8/depot/bpmn/depot.bpmn:16)
- 任务 `send-ctn-arrival-info-to-sa`: [depot.bpmn](/E:/1_course/Phd_Y1_S2/Concurrency_theory/Project20260331/Camunda/code-camunda8/depot/bpmn/depot.bpmn:24)
- 任务 `send-outbound-ctn-to-ct`: [depot.bpmn](/E:/1_course/Phd_Y1_S2/Concurrency_theory/Project20260331/Camunda/code-camunda8/depot/bpmn/depot.bpmn:38)

## 5. Depot 入站契约

### 5.1 `ask-for-ctn`

基本信息：

- 消息名：`ask-for-ctn`
- 发送方：`Shipping Agency`
- 接收方：`Depot`
- 关联键：`orderId`
- 业务意义：船代请求货场准备空箱

字段清单：

- `orderId: string`
- `timestamp: string`
- `senderId: string`
- `containerId: string`
- `vesselId: string`

JSON 示例：

```json
{
  "orderId": "ORDER-20260507-001",
  "timestamp": "2026-05-07T10:00:00Z",
  "senderId": "SHIPPING-AGENCY-01",
  "containerId": "MSKU1234567",
  "vesselId": "VESSEL-042"
}
```

代码定义：

- 类型：[types.ts](/E:/1_course/Phd_Y1_S2/Concurrency_theory/Project20260331/Camunda/code-camunda8/depot/nodejs/source/types.ts:22)
- 解析：[messages.ts](/E:/1_course/Phd_Y1_S2/Concurrency_theory/Project20260331/Camunda/code-camunda8/depot/nodejs/source/messages.ts:96)

### 5.2 `outbound-ctn-to-depot`

基本信息：

- 消息名：`outbound-ctn-to-depot`
- 发送方：`Transport`
- 接收方：`Depot`
- 关联键：`orderId`
- 业务意义：车队将出口重箱及回执移交给货场

字段清单：

- `orderId: string`
- `timestamp: string`
- `senderId: string`
- `ctnNumber: string`
- `vesselId: string`
- `handOverTime: string`
- `receiptId: string`
- `driverName: string`
- `carLicense: string`

JSON 示例：

```json
{
  "orderId": "ORDER-20260507-001",
  "timestamp": "2026-05-07T11:00:00Z",
  "senderId": "TRANSPORT-FLEET-08",
  "ctnNumber": "MSKU1234567",
  "vesselId": "VESSEL-042",
  "handOverTime": "2026-05-07T11:10:00Z",
  "receiptId": "RECEIPT-20260507-001",
  "driverName": "Zhang San",
  "carLicense": "HU-A-12345"
}
```

代码定义：

- 类型：[types.ts](/E:/1_course/Phd_Y1_S2/Concurrency_theory/Project20260331/Camunda/code-camunda8/depot/nodejs/source/types.ts:28)
- 解析：[messages.ts](/E:/1_course/Phd_Y1_S2/Concurrency_theory/Project20260331/Camunda/code-camunda8/depot/nodejs/source/messages.ts:111)

## 6. Depot 出站契约

### 6.1 `empty-ctn-to-transport`

基本信息：

- 消息名：`empty-ctn-to-transport`
- 发送方：`Depot`
- 接收方：`Transport`
- 关联键：`orderId`
- 触发时机：收到 `ask-for-ctn` 后

字段清单：

- `orderId: string`
- `timestamp: string`
- `senderId: string`
- `transportId: string`
- `containerId: string`
- `vesselId: string`

JSON 示例：

```json
{
  "orderId": "ORDER-20260507-001",
  "timestamp": "2026-05-07T10:05:00Z",
  "senderId": "DEPOT-01",
  "transportId": "TRANSPORT-FLEET-08",
  "containerId": "MSKU1234567",
  "vesselId": "VESSEL-042"
}
```

### 6.2 `ctn-arrival-info-to-sa`

基本信息：

- 消息名：`ctn-arrival-info-to-sa`
- 发送方：`Depot`
- 接收方：`Shipping Agency`
- 关联键：`orderId`
- 触发时机：空箱发送完成后

字段清单：

- `orderId: string`
- `timestamp: string`
- `senderId: string`
- `shippingAgencyId: string`
- `containerId: string`
- `vesselId: string`
- `arrivalTime: string`
- `terminalLocation: string`

JSON 示例：

```json
{
  "orderId": "ORDER-20260507-001",
  "timestamp": "2026-05-07T10:10:00Z",
  "senderId": "DEPOT-01",
  "shippingAgencyId": "SHIPPING-AGENCY-01",
  "containerId": "MSKU1234567",
  "vesselId": "VESSEL-042",
  "arrivalTime": "2026-05-07T10:10:00Z",
  "terminalLocation": "Shanghai Yangshan Terminal"
}
```

### 6.3 `outbound-ctn-to-ct`

基本信息：

- 消息名：`outbound-ctn-to-ct`
- 发送方：`Depot`
- 接收方：`Container Terminal`
- 关联键：`orderId`
- 触发时机：收到 `outbound-ctn-to-depot` 后

字段清单：

- `orderId: string`
- `timestamp: string`
- `senderId: string`
- `containerTerminalId: string`
- `containerId: string`
- `vesselId: string`
- `receiptId: string`
- `loadingCompletedTime: string`
- `terminalLocation: string`
- `handOverTime?: string`
- `driverName?: string`
- `carLicense?: string`

JSON 示例：

```json
{
  "orderId": "ORDER-20260507-001",
  "timestamp": "2026-05-07T11:30:00Z",
  "senderId": "DEPOT-01",
  "containerTerminalId": "CONTAINER-TERMINAL-01",
  "containerId": "MSKU1234567",
  "vesselId": "VESSEL-042",
  "receiptId": "RECEIPT-20260507-001",
  "loadingCompletedTime": "2026-05-07T11:30:00Z",
  "terminalLocation": "Shanghai Yangshan Terminal",
  "handOverTime": "2026-05-07T11:10:00Z",
  "driverName": "Zhang San",
  "carLicense": "HU-A-12345"
}
```

构造逻辑见：

- [messages.ts](/E:/1_course/Phd_Y1_S2/Concurrency_theory/Project20260331/Camunda/code-camunda8/depot/nodejs/source/messages.ts:35)

## 7. Node.js 实现映射

### 7.1 目录结构

`Depot` Node.js 模块当前包含：

- `source/config.ts`
- `source/types.ts`
- `source/messages.ts`
- `source/workers.ts`
- `source/index.ts`
- `source/demo.ts`
- `source/mock-inbound.ts`
- `test/depot.spec.ts`
- `test/workers.spec.ts`
- `test/mock-inbound.spec.ts`

### 7.2 Worker 映射

`Depot` BPMN 与 Worker 的一一对应关系如下：

- `send-empty-ctn-to-transport` -> 发布消息 `empty-ctn-to-transport`
- `send-ctn-arrival-info-to-sa` -> 发布消息 `ctn-arrival-info-to-sa`
- `send-outbound-ctn-to-ct` -> 发布消息 `outbound-ctn-to-ct`

对应实现：

- [workers.ts](/E:/1_course/Phd_Y1_S2/Concurrency_theory/Project20260331/Camunda/code-camunda8/depot/nodejs/source/workers.ts:1)

## 8. 测试说明

### 8.1 单元测试

当前单元测试分为三类：

1. 契约与消息函数测试
   - 文件：[depot.spec.ts](/E:/1_course/Phd_Y1_S2/Concurrency_theory/Project20260331/Camunda/code-camunda8/depot/nodejs/test/depot.spec.ts:1)
   - 覆盖内容：
     - `orderId/containerId/vesselId` 校验
     - 入站消息解析
     - 出站消息构造
     - 默认值与异常路径

2. Worker 行为测试
   - 文件：[workers.spec.ts](/E:/1_course/Phd_Y1_S2/Concurrency_theory/Project20260331/Camunda/code-camunda8/depot/nodejs/test/workers.spec.ts:1)
   - 覆盖内容：
     - worker 注册完整性
     - 三个 worker 的 `publishMessage` 行为
     - `job.complete(...)` 变量回写

3. Mock 测试
   - 文件：[mock-inbound.spec.ts](/E:/1_course/Phd_Y1_S2/Concurrency_theory/Project20260331/Camunda/code-camunda8/depot/nodejs/test/mock-inbound.spec.ts:1)
   - 覆盖内容：
     - mock 参数解析
     - 两类入站 mock 消息的正式载荷生成
     - mock 发布顺序与 TTL/关联键检查

### 8.2 Mock 自测

可通过以下方式执行 Depot mock 测试：

```bash
cd code-camunda8/depot/nodejs
npm test
```

如需执行 Camunda 本地端到端 mock 联调：

```bash
cd code-camunda8/depot/nodejs
npm run demo -- --orderId=ORDER-20260507-001 --mockInbound=true
```

或者分两个终端执行：

```bash
cd code-camunda8/depot/nodejs
npm start
```

```bash
cd code-camunda8/depot/nodejs
npm run mock:inbound -- --orderId=ORDER-20260507-001
```

## 9. 当前验收结论

截至当前，Depot 模块已具备：

- 正式契约文档
- 独立 BPMN 模型
- 独立 Node.js Worker 实现
- 单元测试
- Worker 行为测试
- Mock 测试
- 本地 Camunda mock 联调能力

因此，Depot 部分已经达到“可说明、可测试、可联调”的正式交付状态。
