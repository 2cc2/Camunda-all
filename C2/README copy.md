Owner（OWN）流程 Task Type（Worker 任务类型）

fill-out-certificate-of-entrustment：填写委托证明
handle-order：处理订单（含 Customs Order）
send-order-to-ffw：发送订单给货代（FFW）
send-outbound-ctn-to-transport：把 outbound CTN 发给车队（TRP）
payment：付款
Owner（OWN）对外消息（发送）

M1 order-to-ffw（Owner → Freight Forwarder）
基本信息
消息名：order-to-ffw
发送方：Owner（OWN）
接收方：Freight Forwarder（FFW）
关联键：orderId
触发时机：Owner 完成 handle-order 后，由 send-order-to-ffw Worker 发出
业务意义：把委托订单正式交给货代，触发订舱/报关/提箱等后续链路
字段清单（公共字段必含）
orderId string ✅ 例：ORDER-20260416-001
timestamp string ✅ ISO8601 UTC 例：2026-04-16T10:30:00Z
senderId string ✅ 例：OWNER-01
业务字段（建议最小集）
ffwId string ✅ 货代标识 例：FF-GLOBAL-LOGISTICS
order object ✅ 订单主体
customsOrderNo string ✅ 例：CUS-ORDER-001
goodsDescription string ✅ 例：Mobile Accessories
JSON 载荷示例

{ "orderId": "ORDER-20260416-001", "timestamp": "2026-04-16T10:30:00Z", "senderId": "OWNER-01", "ffwId": "FF-GLOBAL-LOGISTICS", "order": { "customsOrderNo": "CUS-ORDER-001", "goodsDescription": "Mobile Accessories" }}

M2 outbound-ctn-to-transport（Owner → Transport）
基本信息
消息名：outbound-ctn-to-transport
发送方：Owner（OWN）
接收方：Transport（TRP）
关联键：orderId
触发时机：Owner 收到 ctn-to-owner 后，完成装货/出港准备，由 send-outbound-ctn-to-transport Worker 发出
业务意义：通知车队可以接走“已装载的出口箱/重箱”，进入后续运抵货场/码头等环节
字段清单（公共字段必含）
orderId string ✅
timestamp string ✅
senderId string ✅ 例：OWNER-01
业务字段（建议最小集）
transportId string ✅ 例：TRANSPORT-FLEET-08
ctnNumber string ✅ 例：CTN-884821（如果你们要用国际标准箱号，可改为 containerId=MSKU1234567）
direction string ✅ 固定：outbound
JSON 载荷示例

{ "orderId": "ORDER-20260416-001", "timestamp": "2026-04-16T12:00:00Z", "senderId": "OWNER-01", "transportId": "TRANSPORT-FLEET-08", "ctnNumber": "CTN-884821", "direction": "outbound"}

Owner（OWN）对外消息（接收）

M22 ctn-to-owner（Transport → Owner）【你文档已有，我这里给出 Owner 侧接收约束】
Owner 侧要求：
消息名必须是 ctn-to-owner
correlationKey 必须是 orderId
必须包含公共字段 orderId/timestamp/senderId
字段（按你给的定义）
ctnNumber string ✅
handOverTime string ✅
driverName string ✅
carLicense string ✅

（Owner 流程里“收到费用单”）建议定义为 expense-note-to-owner（FFW → Owner）
基本信息
消息名：expense-note-to-owner
发送方：Freight Forwarder（FFW）（也可按你们实际改成 TRP/DPT）
接收方：Owner（OWN）
关联键：orderId
触发时机：费用结算单生成后，由发送方主动发出
业务意义：通知货主付款
字段清单（公共字段必含）
orderId string ✅
timestamp string ✅
senderId string ✅ 例：FF-GLOBAL-LOGISTICS
业务字段（建议最小集）
expenseId string ✅ 例：EXP-20260420-001
expenseAmount number ✅ 保留两位小数 例：1250.50
currency string ✅ ISO4217 例：CNY
JSON 示例

{ "orderId": "ORDER-20260416-001", "timestamp": "2026-04-16T13:00:00Z", "senderId": "FF-GLOBAL-LOGISTICS", "expenseId": "EXP-20260420-001", "expenseAmount": 1250.50, "currency": "CNY"}
代码已对齐的位置（可跑）

Owner 契约 workers/demo：
workers.ts
demo.ts

运行命令：
cd message-demo/nodejs
CAMUNDA_REST_ADDRESS=http://localhost:8088 npm run demo:owner-contract -- --orderId=ORDER-20260420-002 --mockInbound=true

java程序运行：
CAMUNDA_GRPC_ADDRESS=http://127.0.0.1:26500 CAMUNDA_REST_ADDRESS=http://127.0.0.1:8088 OWNER_CONTRACT_DEMO_ENABLED=true mvn -f /home/js/projects/fudan_bingfalilun/Project20260407/Project/code-camunda8/camunda-8-get-started/java/pom.xml spring-boot:run -DskipTests -Dstyle.color=never
