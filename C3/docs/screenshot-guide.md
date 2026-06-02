# 第三行项目截图展示与说明

本文档用于指导最终提交时应该截图什么、在哪里截图、截图里应包含哪些关键信息。

## 1. 总体建议

建议最终至少准备 6 张截图：

1. `Shipping Agency` BPMN 全图
2. `SBGS` BPMN 全图
3. `Shipping Agency` 任务配置截图
4. `Operate` 中 `Shipping Agency` 完成实例
5. `Operate` 中 `SBGS` 完成实例
6. `workers` 运行日志

如果老师要求更完整，可以补充 RabbitMQ 管理页面和 demo 输出截图。

## 2. Camunda Modeler 截图

### 图 1：Shipping Agency BPMN 全图

操作位置：

1. 打开 `Camunda Modeler`
2. 点击 `Open File`
3. 打开 `bpmn/shipping-agency-c8.bpmn`

截图时应包含：

- 整个流程图全貌
- 开始消息事件 `S/O received`
- `handle Manifest` 和 `Make Equipment Receipt` 前后的并行网关
- 服务任务
  - `handle Manifest`
  - `Make Equipment Receipt`
  - `ask Depot for CTN`
  - `ship arrive at CT`
  - `make Crew List to SBGS`
  - `Issue an expense note to the Owner`
- 两个中间消息捕获事件
  - `CTN arrival info received`
  - `Ship departure`
- `handle Manifest` 对外的 3 条消息线：
  - `ff-manifest-received`
  - `ct-manifest-received`
  - `cb-manifest-received`
- 并发结构应为 `S/O received` 后分叉，`handle Manifest` 和 `Make Equipment Receipt` 并行，汇聚后进入 `ask Depot for CTN`

建议命名：

- `图1-ShippingAgency流程图.png`

### 图 2：SBGS BPMN 全图

操作位置：

1. 在 `Camunda Modeler` 中打开 `bpmn/sbgs-c8.bpmn`

截图时应包含：

- 开始消息事件 `Crew List received`
- `Personnel information registration`
- 结束事件

建议命名：

- `图2-SBGS流程图.png`

### 图 3：Shipping Agency 任务配置截图

操作位置：

1. 在 `shipping-agency-c8.bpmn` 中点击任意一个服务任务
2. 建议点 `handle Manifest`
3. 看右侧属性栏

截图时应包含：

- 被选中的服务任务
- 右侧属性栏
- `Task Definition`
- `type = handle-manifest`

作用：

- 证明不是只画了图，而是配置成了 Camunda 8 可执行任务
- 也能证明当前代码实际使用的 task type 是 `handle-manifest`

建议命名：

- `图3-ShippingAgency任务配置.png`

## 3. Operate 截图

打开浏览器访问：

- `http://localhost:8080/operate`

默认账号密码：

- `demo / demo`

### 图 4：Shipping Agency 实例完成截图

操作位置：

1. 进入 `Operate`
2. 左侧进入流程实例列表
3. 找到最新的 `shipping-agency-process`
4. 点进去看实例详情页

截图时应包含：

- 流程名称 `shipping-agency-process`
- 最新实例
- 状态 `COMPLETED`
- 流程轨迹高亮到结束节点

建议命名：

- `图4-ShippingAgency实例完成.png`

### 图 5：SBGS 实例完成截图

操作位置：

1. 在 `Operate` 中找到最新的 `sbgs-process`
2. 打开实例详情页

截图时应包含：

- 流程名称 `sbgs-process`
- 状态 `COMPLETED`
- 流程轨迹高亮到结束节点

建议命名：

- `图5-SBGS实例完成.png`

### 图 6：流程定义列表截图

操作位置：

1. `Operate` 左侧打开流程定义或实例列表页面
2. 找到 `Shipping Agency` 和 `SBGS`

截图时应包含：

- 两个流程都已经部署
- 最好能看到版本号

建议命名：

- `图6-Operate流程定义列表.png`

## 4. workers 日志截图

操作位置：

1. 找到执行 `npm start` 的终端窗口

截图时建议包含这些日志：

- `RabbitMQ bridge forwarded 'so-received'`
- `handle-manifest started`
- `ask-for-ctn and ctn-arrival-info published`
- `RabbitMQ bridge forwarded 'ctn-arrival-info'`
- `crewlist-received and ship-departure-notification published`
- `RabbitMQ bridge forwarded 'crewlist-received'`
- `personnel-information-registration started`
- `expense-note-received started`

作用：

- 证明 RabbitMQ 消息桥接成功
- 证明 Worker 成功消费了任务
- 证明 `Shipping Agency` 和 `SBGS` 都实际执行了

建议命名：

- `图7-workers运行日志.png`

## 5. demo 输出截图

操作位置：

1. 找到执行 `npm run demo -- ORDER-20260520-001` 的终端窗口

截图时应包含：

- `Deploying BPMN files`
- `Publishing 'so-received' to RabbitMQ`
- `Shipping Agency instances`
- `SBGS instances`

建议命名：

- `图8-demo运行结果.png`

## 6. RabbitMQ 页面截图

操作位置：

1. 打开 `http://localhost:15672`
2. 登录 `guest / guest`

可选截图内容：

- `Exchanges` 页面里能看到 `logistics.events`
- `Queues` 页面里能看到 `camunda.message.bridge`
- `Queues` 页面里能看到外部业务队列，例如：
  - `freight-forwarder.inbox`
  - `container-terminal.inbox`
  - `customs-broker.inbox`
  - `depot.inbox`
  - `owner.inbox`
  - `sbgs.inbox`

作用补充：

- `logistics.events` 证明当前项目把业务消息统一发到 RabbitMQ exchange
- `camunda.message.bridge` 证明存在 RabbitMQ -> Camunda 的桥接消费者队列
- 外部业务队列证明第三行对外输出消息也通过 RabbitMQ 发布

作用：

- 证明项目确实使用了 RabbitMQ，而不是直接发 Camunda

建议命名：

- `图9-RabbitMQ页面.png`

## 7. 推荐提交顺序

最终文档或答辩 PPT 中，建议按这个顺序排截图：

1. BPMN 全图
2. 任务配置图
3. Operate 完成实例图
4. workers 日志图
5. demo 输出图
6. RabbitMQ 图

这样老师能先看建模，再看运行结果，最后看技术实现证据。
