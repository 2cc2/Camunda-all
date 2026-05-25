/**
 * RabbitMQ 配置与消息映射
 *
 * 与 C3 组的 RabbitMQ 拓扑兼容：
 *   - Exchange: camunda.events (topic)
 *   - 消息格式: CamundaRabbitMQMessage
 *
 * C2 内部使用 lower-case-with-hyphens，对外发送到 C3 时映射为 Message_XXX_received 格式
 */

// ==================== 连接配置 ====================

export const RABBITMQ_CONNECTION = {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
    host: process.env.RABBITMQ_HOST || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT || '5672'),
    username: process.env.RABBITMQ_USER || 'guest',
    password: process.env.RABBITMQ_PASSWORD || 'guest',
} as const

// ==================== Exchange 定义 ====================

export const EXCHANGE = {
    NAME: 'camunda.events',
    TYPE: 'topic' as const,
}

// ==================== Queue 定义 (C2 专用) ====================

export const QUEUES = {
    /** C2 Owner 接收队列 */
    OWNER: 'camunda.owner',
    /** 全量日志队列 */
    ALL: 'camunda.all',
} as const

// ==================== 消息名映射 ====================

/**
 * C2 内部消息名 -> C3 外部 Camunda 消息名 / RabbitMQ routing key
 */
export const MESSAGE_MAPPING: Record<string, { camundaName: string; routingKey: string }> = {
    // C2 -> C3 Freight Forwarder
    'order-to-ffw': {
        camundaName: 'Message_Owner_order_received',
        routingKey: 'ff.order-received',
    },
    // C2 -> C3 Transport
    'outbound-ctn-to-transport': {
        camundaName: 'Message_Owner_Outbound_CTN_received',
        routingKey: 'transport.outbound-ctn-received',
    },
}

/** 反向映射：Camunda 消息名 -> C2 内部消息名 */
export const CAMUNDA_TO_INTERNAL_MESSAGE: Record<string, string> = {
    'Message_Owner_order_received': 'order-to-ffw',
    'Message_Owner_Outbound_CTN_received': 'outbound-ctn-to-transport',
    'Message_Transport_empty_CTN_received': 'ctn-to-owner',
    'Message_expense_note_received': 'expense-note-to-owner',
}

// ==================== 标准消息格式 ====================

export interface CamundaRabbitMQMessage {
    camundaMessageName: string
    correlationKey: string
    variables: Record<string, unknown>
    eventId: string
    timestamp: string
    source: string
    retryCount: number
    maxRetries: number
}

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
        source: params.source || 'c2-owner-publisher',
        retryCount: 0,
        maxRetries: 3,
    }
}
