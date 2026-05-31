import { RabbitMQPublisher } from './publisher'
import { RabbitMQConsumer } from './consumer'

export class CamundaRabbitMQBridge {
    readonly publisher: RabbitMQPublisher
    readonly consumer: RabbitMQConsumer

    constructor() {
        this.publisher = new RabbitMQPublisher()
        this.consumer = new RabbitMQConsumer()
    }

    async connect(): Promise<void> {
        console.log('[Bridge] 正在连接 RabbitMQ...')
        await this.publisher.connect()
        await this.consumer.connect()
        console.log('[Bridge] RabbitMQ 连接成功')
    }

    async start(): Promise<void> {
        await this.consumer.startConsuming()
        console.log('[Bridge] 桥接服务已启动，消息将自动从 RabbitMQ 转发到 Camunda')
    }

    async close(): Promise<void> {
        console.log('[Bridge] 正在关闭...')
        await this.consumer.close()
        await this.publisher.close()
        console.log('[Bridge] 桥接服务已关闭')
    }
}
