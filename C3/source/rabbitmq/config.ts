/**
 * RabbitMQ 统一配置文件
 *
 * 定义：
 *   - RabbitMQ 连接参数
 *   - Exchange / Queue / Binding 拓扑
 *   - 消息类型与 Camunda Message Name 的映射
 *   - 标准化的消息格式接口
 */

// ==================== 连接配置 ====================

export const RABBITMQ_CONNECTION = {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
    host: process.env.RABBITMQ_HOST || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT || '5672'),
    username: process.env.RABBITMQ_USER || 'guest',
    password: process.env.RABBITMQ_PASSWORD || 'guest',
} as const

// ==================== Camunda REST 配置 ====================

export const CAMUNDA_REST = {
    baseUrl: process.env.CAMUNDA_REST_URL || 'http://localhost:8080',
    publishEndpoint: '/v2/messages/publication',
    correlateEndpoint: '/v2/messages/correlation',
} as const

// ==================== Exchange 定义 ====================

/** 主交换机：所有 Camunda 消息事件的入口 */
export const EXCHANGE = {
    NAME: 'camunda.events',
    TYPE: 'topic' as const,
}

/** 死信交换机：处理消费失败的消息 */
export const DLX_EXCHANGE = {
    NAME: 'dlx.camunda',
    TYPE: 'direct' as const,
}

// ==================== Queue 定义 ====================

export const QUEUES = {
    /** Transport 流程消息队列 */
    TRANSPORT: 'camunda.transport',
    /** Freight Forwarder 流程消息队列 */
    FF: 'camunda.ff',
    /** 全量日志队列（所有消息的副本） */
    ALL: 'camunda.all',
    /** 死信队列 */
    DLQ: 'dlq.camunda',
} as const

// ==================== Routing Key 定义 ====================

/**
 * Routing Key 命名规范: <流程>.<事件类型>
 *
 * Transport 流程:
 *   transport.empty-ctn-received       -> Message_Transport_empty_CTN_received
 *   transport.equipment-receipt-received -> Message_FF_Equipment_Receipt_received
 *   transport.outbound-ctn-received    -> Message_Owner_Outbound_CTN_received
 *
 * FF 流程:
 *   ff.order-received                  -> Message_Owner_order_received
 *   ff.manifest-received               -> Message_FF_Manifest_received
 *   ff.equipment-receipt-received      -> Message_SA_Equipment_Receipt_received
 */
export const ROUTING_KEYS = {
    // Transport 流程
    TRANSPORT_EMPTY_CTN: 'transport.empty-ctn-received',
    TRANSPORT_EQUIPMENT_RECEIPT: 'transport.equipment-receipt-received',
    TRANSPORT_OUTBOUND_CTN: 'transport.outbound-ctn-received',

    // FF 流程
    FF_ORDER: 'ff.order-received',
    FF_MANIFEST: 'ff.manifest-received',
    FF_EQUIPMENT_RECEIPT: 'ff.equipment-receipt-received',
} as const

// ==================== Binding 定义 ====================

export const BINDINGS = [
    // Transport 队列绑定
    { queue: QUEUES.TRANSPORT, exchange: EXCHANGE.NAME, routingKey: 'transport.#' },

    // FF 队列绑定
    { queue: QUEUES.FF, exchange: EXCHANGE.NAME, routingKey: 'ff.#' },

    // 全量日志队列绑定
    { queue: QUEUES.ALL, exchange: EXCHANGE.NAME, routingKey: '#' },

    // 死信队列绑定
    { queue: QUEUES.DLQ, exchange: DLX_EXCHANGE.NAME, routingKey: 'dead' },
] as const

// ==================== Routing Key -> Camunda Message Name 映射 ====================

export const ROUTING_KEY_TO_CAMUNDA_MESSAGE: Record<string, string> = {
    'transport.empty-ctn-received': 'Message_Transport_empty_CTN_received',
    'transport.equipment-receipt-received': 'Message_FF_Equipment_Receipt_received',
    'transport.outbound-ctn-received': 'Message_Owner_Outbound_CTN_received',
    'ff.order-received': 'Message_Owner_order_received',
    'ff.manifest-received': 'Message_FF_Manifest_received',
    'ff.equipment-receipt-received': 'Message_SA_Equipment_Receipt_received',
}

// ==================== 标准消息格式 ====================

/**
 * RabbitMQ 上传输的消息格式
 *
 * 包含 Camunda 所需的元信息 + 业务变量
 */
export interface CamundaRabbitMQMessage {
    /** Camunda 消息名称 (如 Message_Transport_empty_CTN_received) */
    camundaMessageName: string
    /** 关联键 (如 orderId) */
    correlationKey: string
    /** 流程变量 */
    variables: Record<string, unknown>
    /** 消息事件 ID (用于幂等和追踪) */
    eventId: string
    /** 发送时间 ISO 8601 */
    timestamp: string
    /** 消息来源 */
    source: string
    /** 当前重试次数 */
    retryCount: number
    /** 最大重试次数 */
    maxRetries: number
}

/** 创建标准消息的工厂函数 */
export function createMessage(params: {
    camundaMessageName: string
    correlationKey: string
    variables: Record<string, unknown>
    source?: string
}): CamundaRabbitMQMessage {
    return {
        camundaMessageName: params.camundaMessageName,
        correlationKey: params.correlationKey,
        variables: params.variables,
        eventId: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        source: params.source || 'rabbitmq-publisher',
        retryCount: 0,
        maxRetries: 3,
    }
}
