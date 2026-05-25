import { RabbitMQConsumer } from './consumer';
import { RabbitMQPublisher } from './publisher';
export declare class CamundaRabbitMQBridge {
    readonly publisher: RabbitMQPublisher;
    readonly consumer: RabbitMQConsumer;
    constructor();
    connect(): Promise<void>;
    start(): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=bridge.d.ts.map