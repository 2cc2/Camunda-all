# 并发理论课程大作业

## Camunda 第三行小组最终提交说明

### 1. 小组负责范围

本小组负责协作图第三行的两个参与方：

- `Shipping Agency`
- `SBGS`

对应的业务职责如下：

1. `Shipping Agency` 负责接收货代发起的 `S/O` 相关业务请求，并在内部完成舱单处理、设备交接单生成、向货场请求集装箱、接收箱到信息、通知码头船到、向边防发送船员名单、在收到离港通知后向货主出具费用单等工作。
2. `SBGS` 负责接收船代发送的船员名单，并执行 `Personnel information registration`，即边防人员信息登记服务。

### 2. 业务逻辑说明

第三行整体是一个跨组织协作中的局部顺序流程，主线如下：

1. 船代收到来自货代的 `S/O` 消息后启动流程。
2. 船代执行 `handle Manifest`，生成并发送舱单文件。
3. 船代执行 `Make Equipment Receipt`，生成并发送设备交接单。
4. 船代执行 `ask Depot for CTN`，向货场请求集装箱。
5. 船代等待外部返回 `CTN arrival info` 消息。
6. 收到箱到信息后，船代执行 `ship arrive at CT`，向码头发出船到港相关通知。
7. 船代执行 `make Crew List to SBGS`，向边防发送船员名单。
8. 边防收到 `crew-list-to-sbgs` 后启动自身流程，并执行 `Personnel information registration`。
9. 船代继续等待码头发出的 `ship-departure-notification`。
10. 收到离港通知后，船代执行 `Issue an expense note to the Owner`，流程结束。

### 3. 建模实现说明

本组使用 Camunda 8 建模实现，提交内容包含两份可执行 BPMN：

- `shipping-agency-c8.bpmn`
- `sbgs-c8.bpmn`

建模时遵循了共享消息契约文档中的统一要求：

1. 消息名使用 `全小写 + 中划线`
2. Worker `task type` 使用 `全小写 + 中划线`
3. 跨组织关联键统一使用 `orderId`

### 4. Worker 实现说明

由于 Camunda 8 / Zeebe 本身只负责流程编排，不直接执行业务逻辑，因此本组额外开发了 Node.js Worker 服务，负责消费以下任务：

- `handle-manifest`
- `make-equipment-receipt`
- `ask-depot-for-ctn`
- `ship-arrive-at-ct`
- `make-crew-list-to-sbgs`
- `issue-expense-note-to-owner`
- `personnel-information-registration`

其中，部分 Worker 在处理完成后会主动发布消息，驱动后续流程继续执行，例如：

- `ask-depot-for-ctn` 发布 `ctn-arrival-info`
- `make-crew-list-to-sbgs` 发布 `crew-list-to-sbgs`
- `make-crew-list-to-sbgs` 同时发布 `ship-departure-notification`

### 5. 运行环境

本实验在本地 `Camunda 8 Run` 环境中完成，关键环境如下：

- Java：`JDK 21`
- Camunda：`Camunda 8 Run 8.8.22`
- Zeebe Gateway：`http://localhost:8080/v2/`
- Operate：`http://localhost:8080/operate`

### 6. 联调验证结果

本组已完成以下验证：

1. 两份 BPMN 已成功部署到 Camunda 8 Run。
2. Worker 服务能够正常启动并监听任务。
3. 使用 `so-received` 消息可成功启动 `Shipping Agency` 流程。
4. `Shipping Agency` 流程执行过程中能够自动触发 `SBGS` 流程。
5. 在 Operate 中可以观察到两个流程实例均成功流转。
6. 各任务日志显示所有关键服务任务均被成功消费并完成。

### 7. 提交文件清单

建议最终提交以下材料：

1. `bpmn/shipping-agency-c8.bpmn`
2. `bpmn/sbgs-c8.bpmn`
3. `workers/` 目录下的 Worker 代码
4. `docs/message-contracts-shipping-sbgs.md`
5. 本说明文档
6. Camunda Modeler 截图
7. Camunda Operate 截图

### 8. 小结

本组完成了第三行 `Shipping Agency + SBGS` 的可执行 BPMN 建模、Worker 开发、流程部署与本地联调验证，实现了从船代业务启动到边防登记再到船代结束的完整闭环。
