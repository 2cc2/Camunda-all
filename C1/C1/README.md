# C1 Customs Demo

## 本地环境

项目默认使用：

- Camunda 8.8 本地 Docker Compose
- RabbitMQ 3 management
- Node.js Worker + RabbitMQ Bridge

启动基础环境：

```bash
docker compose -f docker-compose.local.yaml --env-file docker-compose.local.env up -d
```

环境检查：

```bash
npm run check:env
```

## 常用命令

安装依赖后可直接使用：

```bash
npm run deploy
npm run workers
npm run run
```

一键端到端验证：

```bash
npm run demo:e2e
```

可指定业务单号：

```bash
npm run demo:e2e -- --orderId=ORDER-20260530-001
```

## 默认地址

- Camunda REST: `http://localhost:8080`
- Camunda Operate/Tasklist UI: `http://localhost:8080`
- Zeebe gRPC: `grpc://localhost:26500`
- RabbitMQ AMQP: `amqp://guest:guest@localhost:5672`
- RabbitMQ 管理台: `http://localhost:15672`

UI 默认登录账号：

- 用户名：`demo`
- 密码：`demo`
