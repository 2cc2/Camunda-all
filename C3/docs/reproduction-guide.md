# 第三行项目复现流程

本文档用于从零复现 `Shipping Agency + SBGS` 的本地运行结果。

## 1. 环境准备

请先确认本机已安装并可正常使用：

- `Java 21`
- `Node.js`
- `Docker Desktop`
- `Camunda 8 Run 8.8.22`
- `Camunda Modeler 5.46.1`

建议先在 PowerShell 中检查：

```powershell
java -version
node -v
npm -v
docker -v
```

## 2. 启动顺序

本项目建议严格按下面顺序启动：

1. 启动 `Camunda 8 Run`
2. 启动 `Docker Desktop`
3. 启动 `RabbitMQ`
4. 启动项目 `workers`
5. 部署 BPMN
6. 运行 demo

## 3. 启动 Camunda 8 Run

进入 `c8run.exe` 所在目录：

```powershell
cd "F:\fdse_learning\研一下课程\并发理论\camunda8-run-8.8-windows-x86_64\c8run-8.8.22"
```

执行：

```powershell
.\c8run.exe start
```

启动成功后，浏览器检查：

- `http://localhost:8080`
- `http://localhost:8080/operate`
- `http://localhost:8080/v2/topology`

如果 `http://localhost:8080/v2/topology` 能正常返回内容，则说明 Camunda 已成功启动。

## 4. 启动 RabbitMQ

先打开 `Docker Desktop`，等待状态变成运行中。

如果已经创建过 RabbitMQ 容器，执行：

```powershell
docker start rabbitmq
```

如果还没有创建过 RabbitMQ 容器，执行：

```powershell
docker run -d --hostname my-rabbit --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

启动成功后，浏览器检查：

- `http://localhost:15672`

默认登录账号密码：

- `username: guest`
- `password: guest`

## 5. 启动 workers 和 RabbitMQ bridge

进入项目目录：

```powershell
cd "F:\fdse_learning\camunda-third-row\camunda-third-row\workers"
```

首次运行先安装依赖：

```powershell
npm install
```

启动 workers：

```powershell
npm start
```

正常情况下终端会看到：

```text
Camunda 8 third-row workers and RabbitMQ bridge started. Waiting for jobs...
```

这一条命令会同时启动：

- Camunda Job Workers
- RabbitMQ -> Camunda 消息桥接消费者

当前默认 RabbitMQ 配置为：

- Exchange：`logistics.events`
- Bridge Queue：`camunda.message.bridge`
- 外部业务队列：
  - `freight-forwarder.inbox`
  - `container-terminal.inbox`
  - `customs-broker.inbox`
  - `depot.inbox`
  - `owner.inbox`
  - `sbgs.inbox`

## 6. 部署 BPMN

新开一个 PowerShell 窗口，进入同一目录：

```powershell
cd "F:\fdse_learning\camunda-third-row\camunda-third-row\workers"
```

执行：

```powershell
npm run deploy
```

成功后会看到 `Deployment succeeded.`。

## 7. 运行 demo

还是在 `workers` 目录中执行：

```powershell
npm run demo -- ORDER-20260520-001
```

这个命令会做这些事情：

1. 重新部署 BPMN
2. 向 RabbitMQ 发送 `so-received`
3. 由 RabbitMQ bridge 转发给 Camunda
4. 自动触发 `Shipping Agency` 流程
5. 自动触发 `SBGS` 流程
6. 最后输出流程实例查询结果

## 8. 成功标准

如果运行成功，应满足以下结果：

1. `npm run deploy` 输出 `Deployment succeeded.`
2. `npm start` 窗口中出现如下关键日志：
   - `RabbitMQ bridge forwarded 'so-received'`
   - `handle-manifest started`
   - `ask-for-ctn and ctn-arrival-info published`
   - `RabbitMQ bridge forwarded 'ctn-arrival-info'`
   - `crewlist-received and ship-departure-notification published`
   - `RabbitMQ bridge forwarded 'crewlist-received'`
   - `personnel-information-registration started`
   - `expense-note-received started`
3. `npm run demo` 能正常结束并输出 `Shipping Agency instances` 和 `SBGS instances`
4. `Operate` 中能看到两个流程实例都完成
5. RabbitMQ 管理页中能看到 `logistics.events` exchange，以及上述业务 inbox queue 和 `camunda.message.bridge`

## 9. 关闭服务

如果需要停止 Camunda，在 `c8run` 目录执行：

```powershell
.\c8run.exe stop
```

如果需要停止 RabbitMQ 容器：

```powershell
docker stop rabbitmq
```

如果需要停止 workers，直接关闭 `npm start` 所在终端即可。
