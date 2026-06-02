/**
 * RabbitMQ 配置与消息映射
 *
 * 与 C3 组的 RabbitMQ 拓扑兼容：
 *   - Exchange: camunda.events (topic)
 *   - 消息格式: CamundaRabbitMQMessage
 *
 * C2 内部使用 lower-case-with-hyphens，对外发送到 C3 时映射为 Message_XXX_received 格式
 */
export declare const RABBITMQ_CONNECTION: {
    readonly url: string;
    readonly host: string;
    readonly port: number;
    readonly username: string;
    readonly password: string;
};
export declare const EXCHANGE: {
    NAME: string;
    TYPE: "topic";
};
export declare const QUEUES: {
    /** C2 Owner 接收队列 */
    readonly OWNER: "camunda.owner";
    /** C2 Owner 入站消息观察队列，不消费，用于 RabbitMQ UI 查看消息体 */
    readonly OWNER_DEBUG: "camunda.owner.debug";
    /** 全量日志队列 */
    readonly ALL: "camunda.all";
};
/**
 * C2 内部消息名 -> C3 外部 Camunda 消息名 / RabbitMQ routing key
 */
export declare const MESSAGE_MAPPING: Record<string, {
    camundaName: string;
    routingKey: string;
}>;
/** 反向映射：Camunda 消息名 -> C2 内部消息名 */
export declare const CAMUNDA_TO_INTERNAL_MESSAGE: Record<string, string>;
export interface CamundaRabbitMQMessage {
    camundaMessageName: string;
    correlationKey: string;
    variables: Record<string, unknown>;
    eventId: string;
    timestamp: string;
    source: string;
    retryCount: number;
    maxRetries: number;
}
export declare function createMessage(params: {
    camundaMessageName: string;
    correlationKey: string;
    variables: Record<string, unknown>;
    source?: string;
}): CamundaRabbitMQMessage;
//# sourceMappingURL=config.d.ts.map