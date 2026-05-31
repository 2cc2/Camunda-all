// ==================== RabbitMQ 连接配置 ====================

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
} as const

// ==================== Exchange 定义 ====================

export const EXCHANGE = {
    NAME: 'camunda.events',
    TYPE: 'topic' as const,
}

export const DLX_EXCHANGE = {
    NAME: 'dlx.camunda',
    TYPE: 'direct' as const,
}

// ==================== Queue 定义 ====================

export const QUEUES = {
    CB: 'camunda.cb',
    CT: 'camunda.ct',
    SA: 'camunda.sa',
    CUSTOMS: 'camunda.customs',
    ALL: 'camunda.all',
    DLQ: 'dlq.camunda',
} as const

// ==================== Routing Key 定义 ====================

export const ROUTING_KEYS = {
    // Customs Broker → Customs
    CB_DECLARATION: 'cb.declaration-submitted',
    CB_APPOINTMENT: 'cb.appointment-submitted',

    // Container Terminal → Customs
    CT_ARRIVAL: 'ct.arrival-to-customs',

    // Shipping Agency → Customs
    SA_MANIFEST: 'sa.manifest-to-customs',

    // Customs → Environment
    CUSTOMS_DECLARE_SUCCESS: 'customs.declare-success',
    CUSTOMS_CLEARANCE_CT: 'customs.clearance.ct',
    CUSTOMS_CLEARANCE_CB: 'customs.clearance.cb',
} as const

// ==================== Binding 定义 ====================

export const BINDINGS = [
    { queue: QUEUES.CB, exchange: EXCHANGE.NAME, routingKey: 'cb.#' },
    { queue: QUEUES.CT, exchange: EXCHANGE.NAME, routingKey: 'ct.#' },
    { queue: QUEUES.SA, exchange: EXCHANGE.NAME, routingKey: 'sa.#' },
    { queue: QUEUES.CUSTOMS, exchange: EXCHANGE.NAME, routingKey: 'customs.#' },
    { queue: QUEUES.ALL, exchange: EXCHANGE.NAME, routingKey: '#' },
    { queue: QUEUES.DLQ, exchange: DLX_EXCHANGE.NAME, routingKey: 'dead' },
] as const

// ==================== Routing Key → Camunda Message Name 映射 ====================

export const ROUTING_KEY_TO_CAMUNDA_MESSAGE: Record<string, string> = {
    [ROUTING_KEYS.CB_DECLARATION]: 'Message_declaration_received',
    [ROUTING_KEYS.CB_APPOINTMENT]: 'Message_Appointment_received',
    [ROUTING_KEYS.CT_ARRIVAL]: 'Message_CTN_and_ship_arrive',
    [ROUTING_KEYS.SA_MANIFEST]: 'Message_CB_Manifest_received',
    [ROUTING_KEYS.CUSTOMS_DECLARE_SUCCESS]: 'Message_declare_success_received',
    [ROUTING_KEYS.CUSTOMS_CLEARANCE_CT]: 'Message_CT_customs_cearance',
    [ROUTING_KEYS.CUSTOMS_CLEARANCE_CB]: 'Message_CB_customs_cearance',
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
        source: params.source || 'rabbitmq-publisher',
        retryCount: 0,
        maxRetries: 3,
    }
}
