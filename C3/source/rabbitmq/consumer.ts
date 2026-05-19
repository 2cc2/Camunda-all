/**
 * RabbitMQ 消费者 - 桥接 RabbitMQ 消息到 Camunda REST API
 *
 * 职责：
 *   - 订阅 RabbitMQ 队列 (transport / ff / all / dlq)
 *   - 将消息转发到 Camunda REST API /v2/messages/publication
 *   - 处理消费失败的重试和死信路由
 *   - 提供优雅关闭
 *
 * 消费流程：
 *   RabbitMQ Queue -> Consumer -> Camunda REST API -> 流程实例继续推进
 */

import * as amqp from 'amqplib'
import {
    RABBITMQ_CONNECTION,
    EXCHANGE,
    DLX_EXCHANGE,
    QUEUES,
    BINDINGS,
    CAMUNDA_REST,
    CamundaRabbitMQMessage,
} from './config'

/** 消息处理结果 */
type HandleResult = 'ack' | 'nack-retry' | 'nack-dlq'

export class RabbitMQConsumer {
    private connection: amqp.ChannelModel | null = null
    private channel: amqp.Channel | null = null
    private ready = false

    // ==================== 连接管理 ====================

    /** 连接到 RabbitMQ 并声明拓扑 */
    async connect(): Promise<void> {
        if (this.ready) return

        try {
            this.connection = await amqp.connect(RABBITMQ_CONNECTION.url)
            this.channel = await this.connection.createChannel()

            // 设置 prefetch：一次最多处理多少条未确认消息
            await this.channel.prefetch(10)

            // 声明交换机
            await this.channel.assertExchange(EXCHANGE.NAME, EXCHANGE.TYPE, { durable: true })
            await this.channel.assertExchange(DLX_EXCHANGE.NAME, DLX_EXCHANGE.TYPE, { durable: true })

            // 声明队列
            const dlqArgs = { 'x-dead-letter-exchange': DLX_EXCHANGE.NAME }
            const normalArgs = {
                'x-dead-letter-exchange': DLX_EXCHANGE.NAME,
                'x-message-ttl': 300000,
            }

            await this.channel.assertQueue(QUEUES.TRANSPORT, { durable: true, arguments: normalArgs })
            await this.channel.assertQueue(QUEUES.FF, { durable: true, arguments: normalArgs })
            await this.channel.assertQueue(QUEUES.ALL, { durable: true, arguments: normalArgs })
            await this.channel.assertQueue(QUEUES.DLQ, { durable: true, arguments: dlqArgs })

            // 声明绑定
            for (const binding of BINDINGS) {
                await this.channel.bindQueue(binding.queue, binding.exchange, binding.routingKey)
            }

            this.ready = true
            console.log('✅ [RabbitMQ Consumer] 连接成功，拓扑已声明')
        } catch (error) {
            console.error('❌ [RabbitMQ Consumer] 连接失败:', error)
            throw error
        }
    }

    // ==================== 启动消费 ====================

    /**
     * 启动消费者，监听所有业务队列
     *
     * - camunda.transport -> Transport 流程消息
     * - camunda.ff        -> FF 流程消息
     * - camunda.all       -> 全量日志 (只记录，不转发)
     * - dlq.camunda       -> 死信队列 (只记录)
     */
    async startConsuming(): Promise<void> {
        if (!this.channel || !this.ready) {
            throw new Error('[RabbitMQ Consumer] 未连接，请先调用 connect()')
        }

        // 消费业务队列
        await this.consumeQueue(QUEUES.TRANSPORT)
        await this.consumeQueue(QUEUES.FF)

        // 消费日志队列 (只记录)
        this.consumeLogQueue(QUEUES.ALL)

        // 消费死信队列 (只记录)
        this.consumeDLQ(QUEUES.DLQ)

        console.log('🔔 [RabbitMQ Consumer] 开始监听所有队列...')
    }

    // ==================== 业务队列消费 ====================

    private consumeQueue(queueName: string): void {
        if (!this.channel) throw new Error('Channel 未初始化')

        this.channel.consume(queueName, async (msg) => {
            if (!msg) return

            const startTime = Date.now()
            let result: HandleResult = 'ack'

            try {
                const raw = msg.content.toString()
                const message: CamundaRabbitMQMessage = JSON.parse(raw)

                console.log(
                    `📨 [${queueName}] 收到消息: ${message.camundaMessageName} (key=${message.correlationKey})`
                )

                // 转发到 Camunda
                await this.forwardToCamunda(message)

                const duration = Date.now() - startTime
                console.log(
                    `✅ [${queueName}] 消息已转发到 Camunda: ${message.camundaMessageName} (${duration}ms)`
                )
                result = 'ack'
            } catch (error) {
                console.error(`❌ [${queueName}] 消息处理失败:`, error)

                // 判断是否需要重试
                const retryCount = this.getRetryCount(msg)
                if (retryCount < 3) {
                    result = 'nack-retry'
                } else {
                    result = 'nack-dlq'
                }
            } finally {
                this.handleResult(msg, result)
            }
        }, { noAck: false })

        console.log(`  📡 监听队列: ${queueName}`)
    }

    // ==================== 日志队列消费 ====================

    private consumeLogQueue(queueName: string): void {
        if (!this.channel) throw new Error('Channel 未初始化')

        this.channel.consume(queueName, (msg) => {
            if (!msg) return

            try {
                const raw = msg.content.toString()
                const message: CamundaRabbitMQMessage = JSON.parse(raw)
                console.log(
                    `📋 [LOG] ${message.camundaMessageName} | key=${message.correlationKey} | eventId=${message.eventId} | source=${message.source}`
                )
            } catch {
                // 日志队列解析失败不影响主流程
            }

            // 日志队列直接确认
            this.channel!.ack(msg)
        }, { noAck: false })

        console.log(`  📡 监听日志队列: ${queueName}`)
    }

    // ==================== 死信队列消费 ====================

    private consumeDLQ(queueName: string): void {
        if (!this.channel) throw new Error('Channel 未初始化')

        this.channel.consume(queueName, (msg) => {
            if (!msg) return

            try {
                const raw = msg.content.toString()
                const message: CamundaRabbitMQMessage = JSON.parse(raw)
                console.error(
                    `💀 [DLQ] 消息已进入死信队列: ${message.camundaMessageName} (key=${message.correlationKey}, retries=${message.retryCount})`
                )
            } catch {
                console.error(`💀 [DLQ] 无法解析的死信消息: ${msg.content.toString()}`)
            }

            // 死信消息确认（不重试）
            this.channel!.ack(msg)
        }, { noAck: false })

        console.log(`  📡 监听死信队列: ${queueName}`)
    }

    // ==================== 转发到 Camunda ====================

    private async forwardToCamunda(message: CamundaRabbitMQMessage): Promise<void> {
        const url = `${CAMUNDA_REST.baseUrl}${CAMUNDA_REST.publishEndpoint}`

        const payload = {
            name: message.camundaMessageName,
            correlationKey: message.correlationKey,
            timeToLive: 300000,
            variables: message.variables,
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })

        if (!response.ok) {
            const text = await response.text()
            throw new Error(`Camunda API 返回 ${response.status}: ${text}`)
        }
    }

    // ==================== 辅助方法 ====================

    /** 获取消息的重试次数 */
    private getRetryCount(msg: amqp.Message): number {
        const death = msg.properties.headers?.['x-death']
        if (Array.isArray(death) && death.length > 0) {
            return death[0].count || 0
        }
        return 0
    }

    /** 根据处理结果执行 ack/nack */
    private handleResult(msg: amqp.Message, result: HandleResult): void {
        if (!this.channel) return

        switch (result) {
            case 'ack':
                this.channel.ack(msg)
                break
            case 'nack-retry':
                // 重新入队
                this.channel.nack(msg, false, true)
                break
            case 'nack-dlq':
                // 不重新入队，路由到死信队列
                this.channel.nack(msg, false, false)
                break
        }
    }

    // ==================== 关闭 ====================

    async close(): Promise<void> {
        try {
            if (this.channel) await this.channel.close()
            if (this.connection) await this.connection.close()
        } catch {
            // 忽略关闭时的错误
        }
        this.ready = false
        this.connection = null
        this.channel = null
        console.log('✅ [RabbitMQ Consumer] 连接已关闭')
    }

    isReady(): boolean {
        return this.ready
    }
}
