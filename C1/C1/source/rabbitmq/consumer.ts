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

type HandleResult = 'ack' | 'nack-retry' | 'nack-dlq'

export class RabbitMQConsumer {
    private connection: amqp.ChannelModel | null = null
    private channel: amqp.Channel | null = null
    private ready = false

    async connect(): Promise<void> {
        if (this.ready) return

        this.connection = await amqp.connect(RABBITMQ_CONNECTION.url)
        this.channel = await this.connection.createChannel()

        await this.channel.prefetch(10)

        // 声明交换机
        await this.channel.assertExchange(EXCHANGE.NAME, EXCHANGE.TYPE, { durable: true })
        await this.channel.assertExchange(DLX_EXCHANGE.NAME, DLX_EXCHANGE.TYPE, { durable: true })

        // 声明队列
        const args = {
            'x-dead-letter-exchange': DLX_EXCHANGE.NAME,
            'x-message-ttl': 300000,
        }
        const dlqArgs = { 'x-dead-letter-exchange': DLX_EXCHANGE.NAME }

        await this.channel.assertQueue(QUEUES.CB, { durable: true, arguments: args })
        await this.channel.assertQueue(QUEUES.CT, { durable: true, arguments: args })
        await this.channel.assertQueue(QUEUES.SA, { durable: true, arguments: args })
        await this.channel.assertQueue(QUEUES.CUSTOMS, { durable: true, arguments: args })
        await this.channel.assertQueue(QUEUES.ALL, { durable: true, arguments: args })
        await this.channel.assertQueue(QUEUES.DLQ, { durable: true, arguments: dlqArgs })

        // 声明绑定
        for (const binding of BINDINGS) {
            await this.channel.bindQueue(binding.queue, binding.exchange, binding.routingKey)
        }

        this.ready = true
        console.log('[RabbitMQ Consumer] 连接成功，拓扑已声明')
    }

    async startConsuming(): Promise<void> {
        if (!this.channel || !this.ready) {
            throw new Error('[RabbitMQ Consumer] 未连接，请先调用 connect()')
        }

        // 消费所有业务队列
        await this.consumeQueue(QUEUES.CB)
        await this.consumeQueue(QUEUES.CT)
        await this.consumeQueue(QUEUES.SA)
        await this.consumeQueue(QUEUES.CUSTOMS)

        // 日志队列（只记录）
        this.consumeLogQueue(QUEUES.ALL)

        // 死信队列（只记录）
        this.consumeDLQ(QUEUES.DLQ)

        console.log('[RabbitMQ Consumer] 开始监听所有队列...')
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
                    `  📨 [${queueName}] ${message.camundaMessageName} (key=${message.correlationKey})`
                )

                // 转发到 Camunda REST API
                await this.forwardToCamunda(message)

                const duration = Date.now() - startTime
                console.log(
                    `  ✅ [${queueName}] 已转发到 Camunda: ${message.camundaMessageName} (${duration}ms)`
                )
                result = 'ack'
            } catch (error) {
                console.error(`  ❌ [${queueName}] 处理失败:`, error)

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

        console.log(`    监听队列: ${queueName}`)
    }

    // ==================== 日志队列 ====================

    private consumeLogQueue(queueName: string): void {
        if (!this.channel) return

        this.channel.consume(queueName, (msg) => {
            if (!msg) return

            try {
                const raw = msg.content.toString()
                const message: CamundaRabbitMQMessage = JSON.parse(raw)
                console.log(
                    `  📋 [LOG] ${message.camundaMessageName} | key=${message.correlationKey} | eventId=${message.eventId}`
                )
            } catch { /* ignore */ }

            this.channel!.ack(msg)
        }, { noAck: false })

        console.log(`    监听日志队列: ${queueName}`)
    }

    // ==================== 死信队列 ====================

    private consumeDLQ(queueName: string): void {
        if (!this.channel) return

        this.channel.consume(queueName, (msg) => {
            if (!msg) return

            try {
                const raw = msg.content.toString()
                const message: CamundaRabbitMQMessage = JSON.parse(raw)
                console.error(
                    `  💀 [DLQ] 消息已进入死信: ${message.camundaMessageName} (key=${message.correlationKey}, retries=${message.retryCount})`
                )
            } catch {
                console.error(`  💀 [DLQ] 无法解析死信消息`)
            }

            this.channel!.ack(msg)
        }, { noAck: false })

        console.log(`    监听死信队列: ${queueName}`)
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

    private getRetryCount(msg: amqp.Message): number {
        const death = msg.properties.headers?.['x-death']
        if (Array.isArray(death) && death.length > 0) {
            return death[0].count || 0
        }
        return 0
    }

    private handleResult(msg: amqp.Message, result: HandleResult): void {
        if (!this.channel) return

        switch (result) {
            case 'ack':
                this.channel.ack(msg)
                break
            case 'nack-retry':
                this.channel.nack(msg, false, true)
                break
            case 'nack-dlq':
                this.channel.nack(msg, false, false)
                break
        }
    }

    async close(): Promise<void> {
        try {
            if (this.channel) await this.channel.close()
            if (this.connection) await this.connection.close()
        } catch { /* ignore */ }
        this.ready = false
        this.connection = null
        this.channel = null
        console.log('[RabbitMQ Consumer] 连接已关闭')
    }

    isReady(): boolean {
        return this.ready
    }
}
