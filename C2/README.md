# Camunda 协作流程系统（并发理论课程大作业）

本仓库主要包含两类内容：

- **Camunda 8 可运行流程与 Workers**（见 `code-camunda8/`）
- **形式化建模/验证材料**（CPN Tools、mCRL2 等，见 `code-cpntools/`、`code-mCRL2/`）

更完整的实验指导书与背景说明见：`Collaboration.txt`。

---

## 目录结构

```text
.
├─ code-camunda8/            # Camunda 8 流程与 workers（Java/Node.js）
│  ├─ camunda-8-get-started/ # 官方 get-started demo（含本仓库扩展的 owner_contract）
│  └─ message-demo/          # 消息协作/契约 demo（BPMN + Node.js workers）
├─ code-cpntools/            # CPN Tools 模型
├─ code-mCRL2/               # mCRL2 模型与性质验证
├─ Collaboration.txt         # 实验指导书（较长）
└─ README.md                 # 你正在读的总览
```

---

## code-camunda8：已完成 / 未完成（截至 2026-04-20）

下面的“完成/未完成”以 `code-camunda8/` 为准，基于当前仓库代码与文件结构整理（不含你本机其他路径的内容）。

### 已完成

#### 1) Owner 出口委托合同（Owner Contract）最小可跑链路

- BPMN（Owner 单方流程）：`code-camunda8/message-demo/bpmn/owner-export-contract.bpmn`。
- Node.js workers + demo（Owner Contract）：
  - `code-camunda8/message-demo/nodejs/source/owner-contract/workers.ts`
  - `code-camunda8/message-demo/nodejs/source/owner-contract/demo.ts`（包含：部署 BPMN、启动流程、mock 入站消息）
- Java workers（Owner Contract）：`code-camunda8/camunda-8-get-started/java/src/main/java/.../owner_contract/*Worker.java`。

### 未完成 / 待完善

#### 1) Java demo runner 的 BPMN 资源位置

（已处理）`OwnerContractDemoRunner` 从 classpath 部署 `owner-export-contract.bpmn`。

- 目前该 BPMN 已存在于 `code-camunda8/camunda-8-get-started/java/src/main/resources/owner-export-contract.bpmn`，因此 `spring-boot:run` 场景下可以被正常加载。
- 另外 `src/test/resources/` 下也仍有一份同名 BPMN；建议后续保留单一来源，避免两份文件内容漂移导致“测试通过但运行时不一致”。

#### 2) 契约字段仍需统一（跨语言/跨参与方）

- Node 的 `payment` worker 使用 `expenseAmount/currency`，Java 的 `PaymentWorker` 使用 `expenseNote` 对象结构；需要统一后才能做到“同一份契约，两端实现可互换”。
- 目前仅覆盖 Owner 最小链路；其余参与方（FFW/TRP/Terminal/Customs/...）对应 BPMN/消息与 workers 尚未补齐。

---

## 快速运行（本地 Camunda 8 Run）

前置条件（建议）：

- Camunda 8 Run 本地已启动（默认 REST：`http://localhost:8080`，gRPC：`http://localhost:26500`）。
- Node.js 18+（用于 `fetch`），Java 21+（用于 Spring Boot 3.5）。

### 运行 Node.js：Owner Contract demo

```bash
cd code-camunda8/message-demo/nodejs
npm i
CAMUNDA_REST_ADDRESS=http://localhost:8080 npm run demo:owner-contract -- --orderId=ORDER-20260420-002 --mockInbound=true
```

### 运行 Java：get-started + workers

```bash
cd code-camunda8/camunda-8-get-started/java
mvn -DskipTests spring-boot:run
```

> 备注：Java 的 Owner Contract demo runner 会从 classpath 部署 `owner-export-contract.bpmn`；请确认 `src/main/resources/` 下存在该文件。

---

## Owner 详细实现（BPMN + Workers + Demo）

这一节描述“Owner 出口委托合同（Owner Contract）”在本仓库中**如何落到 BPMN、Worker 代码与可跑 demo**，方便后续扩展到其他参与方。

### 1) BPMN 设计（Owner 单方最小链路）

对应文件：`code-camunda8/message-demo/bpmn/owner-export-contract.bpmn`

流程结构（从左到右）：

1. Start
2. Service Task：`fill-out-certificate-of-entrustment`
3. Service Task：`handle-order`
4. Service Task：`send-order-to-ffw`（对外发布 `order-to-ffw`）
5. Intermediate Catch Message：等待 `ctn-to-owner`（`correlationKey = orderId`）
6. Service Task：`send-outbound-ctn-to-transport`（对外发布 `outbound-ctn-to-transport`）
7. Intermediate Catch Message：等待 `expense-note-to-owner`（`correlationKey = orderId`）
8. Service Task：`payment`
9. End

关键点：

- 两个消息捕获事件都配置了 `zeebe:subscription correlationKey="=orderId"`，因此**流程变量 `orderId` 必须在流程早期就存在**（demo 会在启动实例时注入）。

### 2) Node.js 实现（Camunda REST Client）

对应目录：`code-camunda8/message-demo/nodejs/source/owner-contract/`

关键文件与职责：

- `config.ts`
  - 统一约定 `JOB_TYPES` / `MESSAGE_NAMES` / `PROCESS_IDS` 与参与方标识（`OWNER-01` 等）。
- `workers.ts`
  - 用 `client.createJobWorker` 注册 5 个 worker（与 BPMN 的 task type 一一对应）。
  - 对“对外发消息”的两个任务（`send-order-to-ffw`、`send-outbound-ctn-to-transport`）调用 `client.publishMessage`。
  - 对“必填字段”做了最小校验（例如 `requireString(orderId)`、`requireNumber(expenseAmount)`），避免因为变量缺失导致流程卡死。
- `demo.ts`
  - 启动前用 `assertReachable` 检查 `CAMUNDA_REST_ADDRESS` 是否可访问。
  - `deployOwnerModel`：用 `client.deployResources` 部署 BPMN（从 `../bpmn/owner-export-contract.bpmn` 读取）。
  - `createProcessInstance`：以 `processDefinitionId = owner-export-contract` 启动实例，并注入 `orderId`。
  - `mockInboundMessages`：发布两条入站消息（`ctn-to-owner`、`expense-note-to-owner`）模拟外部参与方，保证链路可在本地独立跑通。

你可以把它理解为：Node.js demo 负责“把引擎跑起来 + 把消息喂进去”，workers 负责“完成服务任务 + 对外发消息”。

### 3) Java 实现（CamundaClient / Spring Boot Worker）

对应包：`code-camunda8/camunda-8-get-started/java/src/main/java/io/camunda/demo/process_order/owner_contract/`

关键文件与职责：

- `OwnerContractConstants.java`
  - 统一常量：`PROCESS_ID`、各 `JOB_*`、各 `MSG_*`、以及参与方 `senderId` 示例。
- `*Worker.java`
  - 通过 `@JobWorker(type = ...)` 绑定任务类型；返回 `Map<String,Object>` 作为完成任务时写回的变量。
  - `SendOrderToFfwWorker` / `SendOutboundCtnToTransportWorker` 内部使用 `client.newPublishMessageCommand()` 对外发布消息。
- `OwnerContractDemoRunner.java`
  - 通过配置 `owner.contract.demo.enabled=true` 控制是否在启动时自动跑 demo。
  - 启动后：部署 BPMN → 启动流程实例（注入 `orderId/timestamp/senderId`）→ 发布两条入站消息。

注意：Java demo runner 会从 classpath 找到 `owner-export-contract.bpmn` 并部署；当前仓库已将该文件放入 `src/main/resources/`。如果你后续修改了 BPMN，也请同步/清理 `src/test/resources/` 的同名文件，避免两份不一致。

---

## 实现过程中的困难与踩坑记录

下面这些点是从当前仓库代码结构中**可以客观确认**的“容易卡住/需要统一”的地方：

1. **BPMN 资源的“单一来源”问题（Java）**
  - `OwnerContractDemoRunner` 使用 `addResourceFromClasspath("owner-export-contract.bpmn")`（运行时从 `src/main/resources/` 加载）。
  - 当前 `src/main/resources/` 与 `src/test/resources/` 各存在一份同名 BPMN：
    - 好处：测试/运行都能各自找到资源；
    - 风险：两份内容可能逐渐不一致，造成“本地跑的流程”和“测试用的流程”不是同一个。
  - 建议：后续保留单一来源（例如只保留 `src/main/resources/`，测试也复用它）。

2. **消息相关联的时序与 TTL**
   - Owner 流程依赖两条外部入站消息（`ctn-to-owner`、`expense-note-to-owner`）。
   - 若消息发布过早/过晚、或 `correlationKey` 不一致，流程会停在中间事件。
   - demo 中通过设置 `timeToLive` 并使用统一 `orderId` 来降低“时序不确定性”带来的失败概率。

3. **跨语言变量结构未完全统一**
   - Node 的 `payment` worker 使用 `expenseAmount/currency`；Java 的 `PaymentWorker` 使用 `expenseNote` 对象。
   - 这会导致同一份 BPMN/同一套测试在两端实现时需要额外适配，后续应以“契约文档”为准统一字段命名与结构。

4. **配置入口分散（REST vs gRPC）**
   - Node demo 主要通过 `CAMUNDA_REST_ADDRESS` 走 REST API。
   - Java(Spring) 通过 `camunda.client.grpc-address/rest-address`（及其对应环境变量）连接。
   - 实际联调时常见问题是端口/协议配错，因此 README 里统一约定默认：REST `8080`、gRPC `26500`。

5. **只实现 Owner 的“最小闭环”后，扩展到多参与方会遇到组合爆炸**
   - 当前链路能跑通的关键在于：Owner 自己能完成服务任务，并且可以 mock 外部消息。
   - 当补齐 FFW/TRP/Customs/... 后，需要进一步统一：消息命名、字段、幂等（messageId）、以及异常/重试策略，否则协作流程会非常难稳定复现。

## 附录：Owner（OWN）契约草案（Task Type 与消息）

这部分为当前契约草稿的整理版，便于对齐 `code-camunda8/message-demo/nodejs/source/owner-contract/*` 与 `code-camunda8/camunda-8-get-started/java/src/main/java/.../owner_contract/*`。

### Task Type（Worker 任务类型）

- `fill-out-certificate-of-entrustment`：填写委托证明
- `handle-order`：处理订单（含 Customs Order）
- `send-order-to-ffw`：发送订单给货代（FFW）
- `send-outbound-ctn-to-transport`：把 outbound CTN 发给车队（TRP）
- `payment`：付款

### Owner（OWN）对外消息（发送）

#### M1 `order-to-ffw`（Owner → Freight Forwarder）

基本信息：

- 消息名：`order-to-ffw`
- 发送方：Owner（OWN）
- 接收方：Freight Forwarder（FFW）
- 关联键：`orderId`
- 触发时机：Owner 完成 `handle-order` 后，由 `send-order-to-ffw` worker 发出
- 业务意义：把委托订单正式交给货代，触发订舱/报关/提箱等后续链路

字段清单（公共字段必含）：

- `orderId`（string）✅ 例：`ORDER-20260416-001`
- `timestamp`（string）✅ ISO8601 UTC 例：`2026-04-16T10:30:00Z`
- `senderId`（string）✅ 例：`OWNER-01`

业务字段（建议最小集）：

- `ffwId`（string）✅ 例：`FF-GLOBAL-LOGISTICS`
- `order`（object）✅

载荷示例：

```json
{
  "orderId": "ORDER-20260416-001",
  "timestamp": "2026-04-16T10:30:00Z",
  "senderId": "OWNER-01",
  "ffwId": "FF-GLOBAL-LOGISTICS",
  "order": {
    "customsOrderNo": "CUS-ORDER-001",
    "goodsDescription": "Mobile Accessories"
  }
}
```

#### M2 `outbound-ctn-to-transport`（Owner → Transport）

基本信息：

- 消息名：`outbound-ctn-to-transport`
- 发送方：Owner（OWN）
- 接收方：Transport（TRP）
- 关联键：`orderId`
- 触发时机：Owner 收到 `ctn-to-owner` 后，完成装货/出港准备，由 `send-outbound-ctn-to-transport` worker 发出
- 业务意义：通知车队可以接走“已装载的出口箱/重箱”，进入后续运抵货场/码头等环节

字段清单（公共字段必含）：

- `orderId`（string）✅
- `timestamp`（string）✅
- `senderId`（string）✅ 例：`OWNER-01`

业务字段（建议最小集）：

- `transportId`（string）✅ 例：`TRANSPORT-FLEET-08`
- `ctnNumber`（string）✅ 例：`CTN-884821`
- `direction`（string）✅ 固定：`outbound`

载荷示例：

```json
{
  "orderId": "ORDER-20260416-001",
  "timestamp": "2026-04-16T12:00:00Z",
  "senderId": "OWNER-01",
  "transportId": "TRANSPORT-FLEET-08",
  "ctnNumber": "CTN-884821",
  "direction": "outbound"
}
```

### Owner（OWN）对外消息（接收）

#### M22 `ctn-to-owner`（Transport → Owner）

Owner 侧接收约束：

- 消息名必须是 `ctn-to-owner`
- `correlationKey` 必须是 `orderId`
- 必须包含公共字段 `orderId/timestamp/senderId`

字段（按当前定义）：

- `ctnNumber`（string）✅
- `handOverTime`（string）✅
- `driverName`（string）✅
- `carLicense`（string）✅

#### （建议）`expense-note-to-owner`（FFW → Owner）

基本信息：

- 消息名：`expense-note-to-owner`
- 发送方：Freight Forwarder（FFW）（也可按实际改成 TRP/DPT）
- 接收方：Owner（OWN）
- 关联键：`orderId`
- 触发时机：费用结算单生成后，由发送方主动发出
- 业务意义：通知货主付款

字段清单（公共字段必含）：

- `orderId`（string）✅
- `timestamp`（string）✅
- `senderId`（string）✅ 例：`FF-GLOBAL-LOGISTICS`

业务字段（建议最小集）：

- `expenseId`（string）✅ 例：`EXP-20260420-001`
- `expenseAmount`（number）✅ 例：`1250.50`
- `currency`（string）✅ ISO4217 例：`CNY`

载荷示例：

```json
{
  "orderId": "ORDER-20260416-001",
  "timestamp": "2026-04-16T13:00:00Z",
  "senderId": "FF-GLOBAL-LOGISTICS",
  "expenseId": "EXP-20260420-001",
  "expenseAmount": 1250.5,
  "currency": "CNY"
}
```
