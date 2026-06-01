/**
 * RabbitMQ 消费者 (C2 Owner)
 *
 * 订阅 C2 专用队列，收到消息后通过 Camunda REST API 注入到 C2 BPMN。
 * 用于未来其他组修复后向 C2 发送消息的场景（如 C3 Transport 发送 ctn-to-owner）。
 */
import { CamundaRestClient } from '@camunda8/sdk';
export declare class RabbitMQConsumer {
    private readonly camundaClient;
    private connection;
    private channel;
    private ready;
    private consumerTag;
    constructor(camundaClient: CamundaRestClient);
    connect(): Promise<void>;
    startConsuming(): Promise<void>;
    close(): Promise<void>;
    isReady(): boolean;
}
//# sourceMappingURL=consumer.d.ts.map