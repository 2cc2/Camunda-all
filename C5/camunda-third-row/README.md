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
  船代流程，负责从 `so-received` 启动，依次执行舱单处理、EIR 生成、向货场请求箱、接收箱到信息、通知码头船到、向边防发船员名单、等待离港通知、向货主开费用单。
- `bpmn/sbgs-c8.bpmn`
  边防流程，负责从 `crew-list-to-sbgs` 启动，并执行 `personnel-information-registration`。
- `workers/src/index.js`
  启动全部 Worker。
- `workers/src/deploy.js`
  只部署 BPMN。
- `workers/src/demo.js`
  一键部署并用消息启动 `Shipping Agency` 流程，然后自动观察 `SBGS` 是否被带起。

## 先决条件

- 已安装并启动 `Camunda 8 Run`
- 已安装 `Node.js`
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
2. 保留第三行本身的顺序业务逻辑
   你们负责的第三行内部没有像货代、海关那样显式的 AND 汇聚点，因此这里不强行加入并行网关，避免把原图建错。

## 可演示结果

执行 `npm run demo` 后，可以在 Operate 中看到：

1. `shipping-agency-process` 被 `so-received` 消息启动
2. 船代任务依次被 worker 消费
3. `crew-list-to-sbgs` 被 worker 发布后，`sbgs-process` 自动启动
4. 边防完成人员信息登记
5. 船代收到 `ship-departure-notification` 后完成费用单流程

## 建议提交内容

- 两份 BPMN
- `workers/` 代码
- `docs/third-row-task-summary.md`
- `docs/message-contracts-shipping-sbgs.md`
- Operate 截图
- Camunda Modeler 截图
