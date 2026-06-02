# Camunda 第三行作业交付

这个目录是你们小组负责的 `Shipping Agency + SBGS` 的 Camunda 8 可运行提交版，包含 4 类内容：

1. `bpmn/`
   两份 Camunda 8 BPMN，可直接用 Camunda Desktop Modeler 打开并部署。
2. `workers/`
   Node.js Worker 和部署/演示脚本。
3. `docs/`
   任务说明、消息契约建议稿、实验说明。
4. `README.md`
   本地联调步骤。

## 目录说明

- `bpmn/shipping-agency-c8.bpmn`
  船代流程，负责从 `so-received` 启动，并行执行舱单处理和 EIR 生成，汇聚后继续向货场请求箱、接收箱到信息、通知码头船到、向边防发船员名单、等待离港通知、向货主开费用单。
- `bpmn/sbgs-c8.bpmn`
  边防流程，负责从 `crewlist-received` 启动，并执行 `personnel-information-registration`。
- `workers/src/index.js`
  启动全部 Worker。
- `workers/src/deploy.js`
  只部署 BPMN。
- `workers/src/demo.js`
  一键部署并用消息启动 `Shipping Agency` 流程，然后自动观察 `SBGS` 是否被带起。

## 先决条件

- 已安装并启动 `Camunda 8 Run`
- 已安装 `Node.js`
- 已安装并启动 `RabbitMQ`
- Camunda 8 Run 默认地址仍为 `http://localhost:8080`
- Zeebe REST 地址可用

## 联调步骤

1. 启动 Camunda 8 Run

在你的 Camunda 8 Run 根目录执行：

```powershell
.\c8run.exe start
```

首次启动或机器较慢时，`Elasticsearch + Camunda` 可能需要 2 到 4 分钟才能完全健康。
可以用下面两个地址确认：

```powershell
http://localhost:9200
http://localhost:8080/v2/topology
```

2. 安装 worker 依赖

```powershell
cd F:\fdse_learning\研一下课程\并发理论\Project\Project\code-camunda8\camunda-third-row\workers
npm install
```

3. 启动 workers

```powershell
npm start
```

`npm start` 现在会同时启动两部分：

- Camunda Job Workers
- RabbitMQ -> Camunda 的消息桥接消费者

4. 部署 BPMN

```powershell
npm run deploy
```

5. 运行完整演示

```powershell
npm run demo
```

你也可以手动指定 `orderId`：

```powershell
npm run demo -- ORDER-20260421-002
```

## 在 Modeler 里的配置

部署目标请选：

- `Target`: `Self-Managed`
- `Cluster endpoint`: `http://localhost:26500`
- `Authentication`: `None`

## 设计说明

这份提交版有两个刻意处理：

1. 统一把消息名和 task type 改成了 `全小写 + 中划线`
   这是你们共享消息契约文档的硬性要求。
2. 对 `handle Manifest` 和 `Make Equipment Receipt` 采用并发优化建模
   两个任务都只依赖 `S/O received`，彼此没有严格先后依赖，因此使用并行网关同时执行；两个分支汇聚后再进入 `ask Depot for CTN`，保证后续请求箱动作发生在舱单和 EIR 都完成之后。

## 可演示结果

执行 `npm run demo` 后，可以在 Operate 中看到：

1. `shipping-agency-process` 被 `so-received` 消息启动
2. 船代并行执行 `handle-manifest` 和 `make-equipment-receipt`，两者完成后继续后续任务
3. `so-received`、`crewlist-received`、`ctn-arrival-info`、`ship-departure-notification` 都会先进入 RabbitMQ，再由桥接消费者转发到 Camunda
4. `crewlist-received` 被 worker 发布后，`sbgs-process` 自动启动
5. 边防完成人员信息登记
6. 船代收到 `ship-departure-notification` 后完成费用单流程

RabbitMQ 中当前项目使用 1 个业务 topic exchange：`logistics.events`。对外 8 类输出消息通过 routing key 区分，并绑定到对应外部参与方 inbox queue；推进 Camunda 的输入消息由 `camunda.message.bridge` 队列消费后转发到 Camunda。

## 建议提交内容

- 两份 BPMN
- `workers/` 代码
- `docs/third-row-task-summary.md`
- `docs/message-contracts-shipping-sbgs.md`
- Operate 截图
- Camunda Modeler 截图
