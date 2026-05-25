# C2 Depot 启动方式与实验报告说明

## 当前代码的正确启动方式

当前 `C2/depot` 代码使用的是：

- 本机安装版 `Erlang/OTP`
- 本机安装版 `RabbitMQ Server`
- 本地 `Camunda 8 Run`

因此不再使用 Docker 命令启动 RabbitMQ。

## 启动步骤

### 1. 进入项目目录

```bat
cd E:\1_course\Phd_Y1_S2\Concurrency_theory\Project20260331\Camunda-all\C2\code-camunda8\depot\nodejs
```

### 2. 安装依赖

```bat
npm install
```

### 3. 启动本机 RabbitMQ 服务

在管理员终端执行：

```bat
net start RabbitMQ
```

如果 RabbitMQ 管理页面没有启用，则进入 RabbitMQ 安装目录下的 `sbin` 执行：

```bat
rabbitmq-plugins enable rabbitmq_management
```

然后访问：

```text
http://localhost:15672
```

默认账号一般为：

- 用户名：`guest`
- 密码：`guest`

### 4. 启动 Camunda 8 Run

保证以下地址可访问：

```text
REST:  http://localhost:8080
gRPC:  localhost:26500
```

如果本机地址不同，可在当前终端设置：

```bat
set CAMUNDA_REST_ADDRESS=http://localhost:8080
set CAMUNDA_GRPC_ADDRESS=grpc://localhost:26500
set RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

### 5. 先检查运行环境

```bat
npm run check:env
```

### 6. 运行完整闭环 Demo

```bat
npm run demo:e2e -- --orderId=ORDER-20260525-001 --mockInbound=true
```

### 7. 其他可用脚本

只启动 Depot Worker + RabbitMQ Bridge：

```bat
npm run start
```

发送 Depot 标准 mock 入站消息：

```bat
npm run mock:inbound -- --orderId=ORDER-20260525-001
```

发送兼容 C3 风格的入站消息：

```bat
npm run mock:c3 -- --orderId=ORDER-20260525-001
```

旁路观察三条出站消息：

```bat
npm run watch:outbound
```

## 为什么不能再用 docker run

因为当前机器没有安装 Docker Desktop，所以 `docker` 命令不存在。  
但是这并不影响 RabbitMQ 的使用，因为 RabbitMQ 已经作为 Windows 本机服务安装完成。  
此时应该使用：

```bat
net start RabbitMQ
```

而不是：

```bat
docker run ...
```

## 可直接写入实验报告的表述

本阶段 C2 组对 `Depot` 模块的启动方式进行了调整。原先文档中使用 Docker 启动 RabbitMQ 的方式，不适用于当前实验环境，因为本机采用的是 Windows 安装版 RabbitMQ Server，而非 Docker 容器版。因此，系统最终采用“本机 RabbitMQ 服务 + 本地 Camunda 8 Run + Node.js Worker/Bridge”的部署方式。启动时，首先通过 `net start RabbitMQ` 启动消息中间件服务，并启用 `rabbitmq_management` 插件以便通过 `http://localhost:15672` 观察消息运行状态；随后启动本地 Camunda 8 Run，并通过 `npm run check:env` 对运行环境进行连通性检查；确认无误后，再执行 `npm run demo:e2e -- --orderId=... --mockInbound=true` 完成 `Depot` 模块的端到端验证。

通过上述方式，`Depot` 代码的运行依赖关系更加清晰，也更符合当前本机实验环境。这样既避免了 Docker 缺失导致的命令错误，也保证了 RabbitMQ 中间件架构下的完整联调流程能够被正确启动与验证。
