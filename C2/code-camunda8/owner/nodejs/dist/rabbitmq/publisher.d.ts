/**
 * RabbitMQ 消息发布器 (C2 Owner)
 *
 * 将 C2 的内部消息通过 RabbitMQ 发布到 C3 组。
 * 与 C3 的 RabbitMQ 拓扑兼容：exchange 'camunda.events' (topic)
 */
export declare class RabbitMQPublisher {
    private connection;
    private channel;
    private ready;
    connect(): Promise<void>;
    /**
     * 发布消息到 RabbitMQ
     *
     * @param internalMessageName C2 内部消息名 (如 'order-to-ffw')
     * @param correlationKey 关联键 (orderId)
     * @param variables 流程变量
     */
    publish(internalMessageName: string, correlationKey: string, variables: Record<string, unknown>): Promise<boolean>;
    publishCamundaMessage(params: {
        camundaMessageName: string;
        routingKey: string;
        correlationKey: string;
        variables: Record<string, unknown>;
        source?: string;
    }): Promise<boolean>;
    close(): Promise<void>;
    isReady(): boolean;
}
//# sourceMappingURL=publisher.d.ts.map