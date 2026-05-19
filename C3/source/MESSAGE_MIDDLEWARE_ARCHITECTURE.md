# Camunda 消息流 + 消息中间件架构设计

## 📊 当前系统架构分析

### 现有消息流
```
Owner Process (订单流程)
├─ Message_Owner_order_received (触发 FF 流程)
├─ Message_FF_Equipment_Receipt_received
├─ Message_Transport_empty_CTN_received
└─ Message_Owner_Outbound_CTN_received

Freight Forwarder Process (货代流程)
├─ Message_Owner_order_received (启动流程)
├─ Message_FF_Manifest_received
└─ Message_SA_Equipment_Receipt_received

Transport Process (运输流程)
├─ ctn-to-owner (Job Worker)
└─ outbound-ctn-to-depot (Job Worker)
```

### 现有实现的问题

1. **直接 HTTP 调用**：`sendMsg.ts` 直接调用 Camunda REST API
   - 缺乏异步解耦
   - 消息丢失风险
   - 难以追踪和审计
   - 无法处理消息重试

2. **同步处理**：Job Workers 同步完成任务
   - 无法处理高并发
   - 缺乏优先级控制
   - 难以实现分布式扩展

3. **缺乏消息持久化**：消息丢失后无法恢复

---

## 🏗️ 推荐的消息中间件架构

### 架构图
```
┌─────────────────┐
│   External      │
│   Services      │
│ (FF, Transport) │
└────────┬────────┘
         │ 发布消息
         ▼
┌─────────────────────────────────┐
│   Message Broker (RabbitMQ/Kafka) │◄─── 消息持久化
│  ┌──────────────────────────────┐│
│  │ Topic/Queue 管理             ││
│  │ - order.events               ││
│  │ - manifest.events            ││
│  │ - equipment.receipt.events   ││
│  │ - transport.events           ││
│  └──────────────────────────────┘│
└─────────────────────────────────┘
         │ 订阅消息
         ▼
┌──────────────────────────────────┐
│  Message Consumers (Workers)      │
│  ┌────────────────────────────────┤
│  │ Consumer 1: Camunda Publisher  │ ──► 发送消息给 Camunda
│  ├────────────────────────────────┤
│  │ Consumer 2: Event Processor    │ ──► 处理业务逻辑
│  ├────────────────────────────────┤
│  │ Consumer 3: Audit Logger       │ ──► 审计日志
│  └────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ Camunda 8       │
│ - Processes     │
│ - Jobs          │
│ - Workflows     │
└─────────────────┘
```

---

## 🔄 消息流工作流程

### 1. 消息发布流程
```
外部服务想要触发 Camunda 流程
         │
         ▼
发布消息到消息中间件
(Topic: order.events)
         │
         ▼
消息被持久化存储
(RabbitMQ Queue / Kafka Partition)
         │
         ▼
Consumer 订阅消息
         │
         ▼
从消息中间件消费消息
         │
         ▼
通过 HTTP/gRPC 调用 Camunda API
发布消息给流程
         │
         ▼
Camunda 流程收到消息并继续执行
```

### 2. 消息消费流程
```
业务事件发生
(manifest arrived, equipment receipt received)
         │
         ▼
发布事件到消息中间件
         │
         ▼
多个 Consumer 并行处理
  ├─ Camunda 消息发布器
  ├─ 数据库事件记录器
  ├─ 通知服务
  └─ 分析系统
         │
         ▼
确保至少处理一次(At-Least-Once)
带自动重试机制
```

---

## 📦 推荐的消息中间件选择

### RabbitMQ (推荐用于中等规模)
**优点：**
- 可靠的消息传递（支持 ACK）
- 灵活的路由规则（Exchange + Binding）
- 内置优先级队列支持
- 支持死信队列处理失败消息
- 较低的延迟

**缺点：**
- 不适合超大规模分布式
- 消息存储在内存中（需要持久化配置）

**价格：** 免费开源

### Apache Kafka (推荐用于大规模)
**优点：**
- 高吞吐量（millions/sec）
- 内置消息持久化（分布式存储）
- 完美支持事件溯源
- 消费者组并行处理
- 天然支持分布式扩展

**缺点：**
- 学习曲线陡峭
- 资源消耗较大
- 配置复杂

**价格：** 免费开源

### Redis Streams (推荐用于简单场景)
**优点：**
- 简单易用
- 低延迟
- 支持消费者组
- 内存存储快速

**缺点：**
- 消息存储在内存中，重启丢失（除非启用 RDB/AOF）
- 吞吐量有限
- 不适合超大规模

**价格：** 免费开源

---

## 🎯 实现方案

### 方案 1: RabbitMQ + amqplib

#### 优点
- 消息可靠性强
- 与现有 Node.js 生态配合好
- 支持复杂的路由逻辑

#### 消息拓扑设计
```
Exchange: camunda-events (topic)
├── Queue: camunda-publisher
│   └── RoutingKey: #.received
│       └── Consumer: Camunda API Caller
├── Queue: event-logger
│   └── RoutingKey: #
│       └── Consumer: Database Logger
└── Queue: dead-letter
    └── Consumer: Error Handler
```

---

### 方案 2: Kafka + kafkajs

#### 优点
- 天然适合事件驱动架构
- 完整的消息历史
- 消费者组负载均衡

#### Topic 设计
```
Topics:
├── order-events
│   ├── Partition 0: 订单相关事件
│   ├── Partition 1: 订单相关事件
│   └── Consumer Group: camunda-publisher
├── manifest-events
│   └── Consumer Group: ff-processor
├── equipment-receipt-events
│   └── Consumer Groups: [camunda-publisher, audit-logger]
└── transport-events
    └── Consumer Groups: [camunda-publisher, inventory-updater]
```

---

### 方案 3: Redis Streams (简化方案)

#### 优点
- 最简单快速实现
- 本地开发测试便捷

#### Stream 设计
```
Streams:
├── camunda:orders
├── camunda:manifests
├── camunda:equipment
└── camunda:transport

Consumer Groups:
├── camunda:orders -> [camunda-publisher, logger]
├── camunda:manifests -> [camunda-publisher, logger]
└── ...
```

---

## 💾 消息格式标准化

### 事件消息格式
```json
{
  "eventId": "evt-20260518-001",
  "eventType": "order.received",
  "timestamp": "2026-05-18T10:30:00Z",
  "correlationId": "ORDER-20260420-001",
  "source": "external-system",
  "payload": {
    "orderId": "ORDER-20260420-001",
    "shipperName": "ACME Trading Co., Ltd.",
    "consignee": "Global Buyer Inc.",
    "pol": "CNSHA",
    "pod": "USLAX",
    "commodity": "Electronics",
    "quantity": 1,
    "ctnType": "40HQ"
  },
  "metadata": {
    "version": "1.0",
    "source": "external-api",
    "userId": "system"
  },
  "retryCount": 0,
  "maxRetries": 3
}
```

---

## 🔐 关键特性实现

### 1. 幂等性处理
```typescript
// 使用 eventId 和 idempotency key 确保消息只处理一次
const processedEvents = new Set<string>()

async function handleMessage(message: Message) {
  if (processedEvents.has(message.eventId)) {
    console.log(`Message ${message.eventId} already processed, skipping`)
    return
  }
  
  await processMessage(message)
  processedEvents.add(message.eventId)
}
```

### 2. 死信队列处理
```
主队列处理失败 
    ↓ (3 次重试后)
发送到死信队列
    ↓
人工审查或特殊处理
    ↓
成功后重新发布到主队列
```

### 3. 消息追踪
```typescript
interface MessageTraceLog {
  eventId: string
  correlationId: string
  timestamp: string
  status: 'published' | 'consumed' | 'processed' | 'failed'
  consumer: string
  duration: number
}
```

---

## 📈 部署拓扑

### 开发环境
```
单机部署:
├── RabbitMQ (1 个实例)
├── Camunda 8 (1 个实例)
└── Node.js Workers (多个)
```

### 生产环境
```
高可用部署:
├── RabbitMQ Cluster (3+ 节点)
│   ├── Node 1 (Queue Master)
│   ├── Node 2 (Replica)
│   └── Node 3 (Replica)
├── Camunda 8 Zeebe (3+ 节点)
├── Node.js Worker Pool (自动扩展)
└── 监控和告警 (Prometheus + Grafana)
```

---

## ⚠️ 注意事项

### 顺序性保证
- **问题**：如果同一订单的多条消息乱序，可能导致流程异常
- **解决方案**：
  - 使用 `correlationId` 作为分区键，确保同一订单的消息到同一分区
  - Kafka: 使用 partition key
  - RabbitMQ: 使用同一 queue

### 消息去重
- **使用 eventId + 数据库唯一索引** 实现幂等性
- **DLQ + Manual Review** 处理重复消息

### 监控和告警
- 消息队列深度（Queue Depth）
- 消费延迟（Consumer Lag）
- 消息失败率
- 处理耗时（P50, P95, P99）

---

## 🎓 下一步行动

1. **选择中间件**：根据规模选择 RabbitMQ、Kafka 或 Redis
2. **实现消息发布器**：统一的消息格式和发布接口
3. **实现消息消费器**：处理不同类型的消息
4. **添加持久化和重试机制**
5. **实现监控和追踪**
6. **编写集成测试**
7. **性能测试和优化**
