"use strict";
/**
 * RabbitMQ 配置与消息映射
 *
 * 与 C3 组的 RabbitMQ 拓扑兼容：
 *   - Exchange: camunda.events (topic)
 *   - 消息格式: CamundaRabbitMQMessage
 *
 * C2 内部使用 lower-case-with-hyphens，对外发送到 C3 时映射为 Message_XXX_received 格式
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAMUNDA_TO_INTERNAL_MESSAGE = exports.MESSAGE_MAPPING = exports.QUEUES = exports.EXCHANGE = exports.RABBITMQ_CONNECTION = void 0;
exports.createMessage = createMessage;
// ==================== 连接配置 ====================
exports.RABBITMQ_CONNECTION = {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
    host: process.env.RABBITMQ_HOST || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT || '5672'),
    username: process.env.RABBITMQ_USER || 'guest',
    password: process.env.RABBITMQ_PASSWORD || 'guest',
};
// ==================== Exchange 定义 ====================
exports.EXCHANGE = {
    NAME: 'camunda.events',
    TYPE: 'topic',
};
// ==================== Queue 定义 (C2 专用) ====================
exports.QUEUES = {
    /** C2 Owner 接收队列 */
    OWNER: 'camunda.owner',
    /** 全量日志队列 */
    ALL: 'camunda.all',
};
// ==================== 消息名映射 ====================
/**
 * C2 内部消息名 -> C3 外部 Camunda 消息名 / RabbitMQ routing key
 */
exports.MESSAGE_MAPPING = {
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
};
/** 反向映射：Camunda 消息名 -> C2 内部消息名 */
exports.CAMUNDA_TO_INTERNAL_MESSAGE = {
    'Message_Owner_order_received': 'order-to-ffw',
    'Message_Owner_Outbound_CTN_received': 'outbound-ctn-to-transport',
    'Message_Transport_empty_CTN_received': 'ctn-to-owner',
    'Message_expense_note_received': 'expense-note-to-owner',
};
function createMessage(params) {
    return {
        camundaMessageName: params.camundaMessageName,
        correlationKey: params.correlationKey,
        variables: params.variables,
        eventId: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        source: params.source || 'c2-owner-publisher',
        retryCount: 0,
        maxRetries: 3,
    };
}
//# sourceMappingURL=config.js.map