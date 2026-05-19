/**
 * RabbitMQ <-> Camunda 桥接服务
 *
 * 整合 Publisher 和 Consumer，提供统一的生命周期管理：
 *   1. connect()    -> 连接 RabbitMQ，声明拓扑
 *   2. start()      -> 启动消费者监听 + 返回 Publisher 供发送消息
 *   3. close()      -> 优雅关闭所有连接
 *
 * 典型用法（在 index.ts 中）：
 *
 *   const bridge = new CamundaRabbitMQBridge()
 *   await bridge.connect()
 *   await bridge.start()        // 消费者开始监听
 *
 *   // 用 bridge.publisher 发送消息
 *   await bridge.publisher.publishEmptyCtnReceived(orderId, { ctnNumber: 'CTN-123' })
 */

import { RabbitMQPublisher } from './publisher'
import { RabbitMQConsumer } from './consumer'

export class CamundaRabbitMQBridge {
    readonly publisher: RabbitMQPublisher
    readonly consumer: RabbitMQConsumer

    constructor() {
        this.publisher = new RabbitMQPublisher()
        this.consumer = new RabbitMQConsumer()
    }

    /**
     * 连接到 RabbitMQ，声明 Exchange / Queue / Binding
     *
     * Publisher 和 Consumer 各自建立独立连接（推荐做法，因为
     * RabbitMQ 的 Channel 不应在连接共享的场景下复用）
     */
    async connect(): Promise<void> {
        console.log('🚀 [Bridge] 正在连接 RabbitMQ...')

        await this.publisher.connect()
        await this.consumer.connect()

        console.log('✅ [Bridge] RabbitMQ 连接成功')
    }

    /**
     * 启动消费者，开始监听队列并转发消息到 Camunda
     *
     * 必须在 connect() 之后调用
     */
    async start(): Promise<void> {
        await this.consumer.startConsuming()
        console.log('✅ [Bridge] 桥接服务已启动，消息将自动从 RabbitMQ 转发到 Camunda')
    }

    /**
     * 优雅关闭所有连接
     */
    async close(): Promise<void> {
        console.log('⏹️  [Bridge] 正在关闭...')
        await this.consumer.close()
        await this.publisher.close()
        console.log('✅ [Bridge] 桥接服务已关闭')
    }
}
